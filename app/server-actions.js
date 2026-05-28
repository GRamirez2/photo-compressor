'use server';

import { processBlobImages } from '../lib/image-processing';
import { getSessionId } from '../lib/session';

function toPositiveInteger(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function convertImagesAction(previousState, formData) {
  const sourceBlobUrls = formData
    .getAll('sourceBlobUrls')
    .map((value) => value?.toString().trim())
    .filter(Boolean);

  if (sourceBlobUrls.length === 0) {
    return {
      error: 'Choose at least one image to convert.',
      results: [],
    };
  }

  const format = formData.get('format');
  const maxLength = toPositiveInteger(formData.get('maxLength'));
  const quality = toPositiveInteger(formData.get('quality')) ?? 85;
  const renameEnabled = formData.get('renameEnabled') === 'on';
  const mobileResizeEnabled = formData.get('mobileResizeEnabled') === 'on';
  const renameBase = (formData.get('renameBase') ?? '').toString().trim();

  if (renameEnabled && !renameBase) {
    return {
      error: 'Enter a rename value when Rename Images is enabled.',
      results: [],
    };
  }

  try {
    const sessionId = await getSessionId({ createIfMissing: true });
    const processingOptions = {
      format,
      maxLength,
      quality,
      mobileResizeEnabled,
      renameBase: renameEnabled ? renameBase : null,
    };
    const results = await processBlobImages(sourceBlobUrls, processingOptions, sessionId);

    return {
      error: null,
      results,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unable to process images.',
      results: [],
    };
  }
}