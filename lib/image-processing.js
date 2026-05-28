import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUTPUT_ROOT = process.env.VERCEL
  ? path.join('/tmp', 'photo-compressor', 'generated')
  : path.join(process.cwd(), 'tmp', 'generated');
const SUPPORTED_FORMATS = new Set(['webp', 'jpeg', 'png']);
const BATCH_ID_PATTERN = /^\d+-[a-z0-9]+$/;
const SESSION_ID_PATTERN = /^[a-f0-9-]{36}$/;
const FILE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const MAX_BATCH_AGE_MS = 60 * 60 * 1000;
const RESPONSIVE_SIZE_PRESETS = [
  { desktop: 200, mobile: 120 },
  { desktop: 500, mobile: 320 },
  { desktop: 1200, mobile: 720 },
  { desktop: 1600, mobile: 900 },
];

function isValidSessionId(sessionId) {
  return typeof sessionId === 'string' && SESSION_ID_PATTERN.test(sessionId);
}

function isValidBatchId(batchId) {
  return typeof batchId === 'string' && BATCH_ID_PATTERN.test(batchId);
}

function isValidFileName(fileName) {
  return typeof fileName === 'string' && FILE_NAME_PATTERN.test(fileName) && !fileName.includes('..');
}

function slugifyName(fileName) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
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

async function ensureOutputDirectory(sessionId, batchId) {
  const batchDirectory = path.join(OUTPUT_ROOT, sessionId, batchId);
  await fs.mkdir(batchDirectory, { recursive: true });
  return batchDirectory;
}

async function cleanupOldBatches() {
  let sessionEntries = [];

  try {
    sessionEntries = await fs.readdir(OUTPUT_ROOT, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }

  const now = Date.now();

  await Promise.all(
    sessionEntries
      .filter((entry) => entry.isDirectory())
      .map(async (sessionEntry) => {
        if (!SESSION_ID_PATTERN.test(sessionEntry.name)) {
          return;
        }

        const sessionDirectory = path.join(OUTPUT_ROOT, sessionEntry.name);
        const batchEntries = await fs.readdir(sessionDirectory, { withFileTypes: true }).catch(() => []);

        await Promise.all(
          batchEntries
            .filter((entry) => entry.isDirectory())
            .map(async (batchEntry) => {
              const [timestampPart] = batchEntry.name.split('-');
              const timestamp = Number.parseInt(timestampPart, 10);

              if (!Number.isFinite(timestamp)) {
                return;
              }

              if (now - timestamp > MAX_BATCH_AGE_MS) {
                await fs.rm(path.join(sessionDirectory, batchEntry.name), { recursive: true, force: true });
              }
            })
        );

        const remainingEntries = await fs.readdir(sessionDirectory).catch(() => []);

        if (remainingEntries.length === 0) {
          await fs.rm(sessionDirectory, { recursive: true, force: true });
        }
      })
  );
}

async function persistImage(buffer, format, quality, outputPath, maxLength) {
  let pipeline = sharp(buffer, { failOn: 'none' }).rotate();
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

  const info = await pipeline.toFile(outputPath);
  return info;
}

async function buildOutputResult({
  batchId,
  format,
  inputBuffer,
  maxLength,
  originalName,
  outputDirectory,
  outputName,
  quality,
  sessionId,
}) {
  const outputPath = path.join(outputDirectory, outputName);
  const info = await persistImage(inputBuffer, format, quality, outputPath, maxLength);
  const publicPath = `/api/generated/download?batchId=${encodeURIComponent(batchId)}&file=${encodeURIComponent(outputName)}`;

  return {
    batchId,
    originalName,
    downloadName: outputName,
    downloadUrl: publicPath,
    format,
    width: info.width,
    height: info.height,
    sizeLabel: bytesToLabel(info.size),
  };
}

export async function processImages(files, options, sessionId) {
  if (!isValidSessionId(sessionId)) {
    throw new Error('Unable to determine a valid session for generated images.');
  }

  const { format, maxLength, quality, mobileResizeEnabled, renameBase } = normalizeOptions(options);
  const mobileMaxLength = mobileResizeEnabled ? getMobileMaxLength(maxLength) : null;
  await cleanupOldBatches();

  const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const outputDirectory = await ensureOutputDirectory(sessionId, batchId);

  const processedResults = await Promise.all(
    files.map(async (file, index) => {
      const inputBuffer = Buffer.from(await file.arrayBuffer());
      const safeBaseName = renameBase || slugifyName(file.name);
      const outputBaseName = `${safeBaseName}-${index + 1}`;
      const desktopResult = await buildOutputResult({
        batchId,
        format,
        inputBuffer,
        maxLength,
        originalName: file.name,
        outputDirectory,
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
        inputBuffer,
        maxLength: mobileMaxLength,
        originalName: file.name,
        outputDirectory,
        outputName: `${outputBaseName}-m.${format}`,
        quality,
        sessionId,
      });

      return [desktopResult, mobileResult];
    })
  );

  return processedResults.flat();
}

export function getGeneratedBatchDirectory(sessionId, batchId) {
  if (!isValidSessionId(sessionId) || !isValidBatchId(batchId)) {
    return null;
  }

  return path.join(OUTPUT_ROOT, sessionId, batchId);
}

export async function getGeneratedBatchFiles(sessionId, batchId) {
  const batchDirectory = getGeneratedBatchDirectory(sessionId, batchId);

  if (!batchDirectory) {
    return [];
  }

  const entries = await fs.readdir(batchDirectory, { withFileTypes: true }).catch(() => []);

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => ({
      name: entry.name,
      absolutePath: path.join(batchDirectory, entry.name),
    }));
}

export function getGeneratedFilePath(sessionId, batchId, fileName) {
  if (!isValidSessionId(sessionId) || !isValidBatchId(batchId) || !isValidFileName(fileName)) {
    return null;
  }

  return path.join(OUTPUT_ROOT, sessionId, batchId, fileName);
}

export async function clearGeneratedBatches(sessionId, batchIds = []) {
  if (!isValidSessionId(sessionId)) {
    return;
  }

  await cleanupOldBatches();

  const requestedBatchIds = Array.isArray(batchIds) ? batchIds : [];
  const safeBatchIds = requestedBatchIds.filter((batchId) => isValidBatchId(batchId));

  const sessionDirectory = path.join(OUTPUT_ROOT, sessionId);

  if (safeBatchIds.length > 0) {
    await Promise.all(
      safeBatchIds.map((batchId) =>
        fs.rm(path.join(sessionDirectory, batchId), { recursive: true, force: true })
      )
    );

    return;
  }

  await fs.rm(sessionDirectory, { recursive: true, force: true });
}