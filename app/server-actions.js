'use server';

import { processImages } from '../lib/image-processing';

function toPositiveInteger(value) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function convertImagesAction(previousState, formData) {
  const uploadedFiles = formData
    .getAll('images')
    .filter((entry) => entry instanceof File && entry.size > 0);

  if (uploadedFiles.length === 0) {
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
    const results = await processImages(uploadedFiles, {
      format,
      maxLength,
      quality,
      mobileResizeEnabled,
      renameBase: renameEnabled ? renameBase : null,
    });

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