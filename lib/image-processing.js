import 'server-only';

import { randomUUID } from 'node:crypto';
import { basename } from 'node:path';
import { put } from '@vercel/blob';
import sharp from 'sharp';

const SUPPORTED_FORMATS = new Set(['webp', 'jpeg', 'png']);
const RESPONSIVE_SIZE_PRESETS = [
  { desktop: 200, mobile: 120 },
  { desktop: 500, mobile: 320 },
  { desktop: 1200, mobile: 720 },
  { desktop: 1600, mobile: 900 },
];

function slugifyName(fileName) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
}

function toSafePathSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default';
}

function inferOriginalNameFromUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const rawName = basename(parsedUrl.pathname);
    const decodedName = decodeURIComponent(rawName);
    return decodedName || 'uploaded-image';
  } catch {
    return 'uploaded-image';
  }
}

function bytesToLabel(size) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeOptions(options) {
  const format = SUPPORTED_FORMATS.has(options.format) ? options.format : 'webp';
  const maxLength = options.maxLength && options.maxLength > 0 ? options.maxLength : null;
  const quality = options.quality && options.quality > 0 && options.quality <= 100 ? options.quality : 75;
  const mobileResizeEnabled = options.mobileResizeEnabled === true;
  const renameBase = options.renameBase ? slugifyName(options.renameBase) : null;

  return {
    format,
    maxLength,
    quality,
    mobileResizeEnabled,
    renameBase,
  };
}

function getMobileMaxLength(maxLength) {
  if (!maxLength) {
    return null;
  }

  const exactPreset = RESPONSIVE_SIZE_PRESETS.find((preset) => preset.desktop === maxLength);

  if (exactPreset) {
    return exactPreset.mobile;
  }

  const nearestPreset = RESPONSIVE_SIZE_PRESETS.reduce((closestPreset, preset) => {
    if (!closestPreset) {
      return preset;
    }

    const currentDistance = Math.abs(preset.desktop - maxLength);
    const closestDistance = Math.abs(closestPreset.desktop - maxLength);
    return currentDistance < closestDistance ? preset : closestPreset;
  }, null);

  return nearestPreset?.mobile ?? null;
}

function applyResize(image, maxLength) {
  if (!maxLength) {
    return image;
  }

  return image.resize({
    width: maxLength,
    height: maxLength,
    fit: 'inside',
    withoutEnlargement: true,
  });
}

async function processImageToBuffer(inputBuffer, format, quality, maxLength) {
  let pipeline = sharp(inputBuffer, { failOn: 'none' }).rotate();
  pipeline = applyResize(pipeline, maxLength);

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
      break;
    case 'png':
      pipeline = pipeline.png({ quality, compressionLevel: 9, palette: true });
      break;
    default:
      pipeline = pipeline.webp({ quality });
      break;
  }

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  return { data, info };
}

async function buildOutputResult({
  batchId,
  format,
  inputBuffer,
  maxLength,
  originalName,
  outputName,
  quality,
  sessionId,
}) {
  const { data, info } = await processImageToBuffer(inputBuffer, format, quality, maxLength);
  const safeSessionId = toSafePathSegment(sessionId || 'anonymous');
  const safeBatchId = toSafePathSegment(batchId);
  const blobPath = `generated/${safeSessionId}/${safeBatchId}/${outputName}`;
  const blob = await put(blobPath, data, {
    access: 'public',
    contentType: format === 'jpeg' ? 'image/jpeg' : `image/${format}`,
    addRandomSuffix: false,
  });

  return {
    batchId,
    originalName,
    downloadName: outputName,
    format,
    width: info.width,
    height: info.height,
    sizeLabel: bytesToLabel(data.length),
    url: blob.url,
  };
}

async function processBuffers(inputs, options, sessionId) {
  const { format, maxLength, quality, mobileResizeEnabled, renameBase } = normalizeOptions(options);
  const mobileMaxLength = mobileResizeEnabled ? getMobileMaxLength(maxLength) : null;
  const batchId = randomUUID();

  const processedResults = await Promise.all(
    inputs.map(async (input, index) => {
      const safeBaseName = renameBase || slugifyName(input.originalName);
      const outputBaseName = `${safeBaseName}-${index + 1}`;
      const desktopResult = await buildOutputResult({
        batchId,
        format,
        inputBuffer: input.buffer,
        maxLength,
        originalName: input.originalName,
        outputName: `${outputBaseName}.${format}`,
        quality,
        sessionId,
      });

      if (!mobileMaxLength) {
        return [desktopResult];
      }

      const mobileResult = await buildOutputResult({
        batchId,
        format,
        inputBuffer: input.buffer,
        maxLength: mobileMaxLength,
        originalName: input.originalName,
        outputName: `${outputBaseName}-m.${format}`,
        quality,
        sessionId,
      });

      return [desktopResult, mobileResult];
    })
  );

  return processedResults.flat();
}

export async function processImages(files, options, sessionId) {
  const inputs = await Promise.all(
    files.map(async (file) => ({
      originalName: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
    }))
  );

  return processBuffers(inputs, options, sessionId);
}

export async function processBlobImages(blobUrls, options, sessionId) {
  const inputs = await Promise.all(
    blobUrls.map(async (blobUrl) => {
      const response = await fetch(blobUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Unable to fetch uploaded image (${response.status}).`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return {
        originalName: inferOriginalNameFromUrl(blobUrl),
        buffer: Buffer.from(arrayBuffer),
      };
    })
  );

  return processBuffers(inputs, options, sessionId);
}