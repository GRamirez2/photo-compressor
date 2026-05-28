import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

import { getSessionId } from '../../../lib/session';

export const runtime = 'nodejs';

const ALLOWED_IMAGE_CONTENT_TYPES = [
  'image/avif',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/jpeg',
  'image/png',
  'image/webp',
];

function parseClientPayload(clientPayload) {
  if (!clientPayload) {
    return {};
  }

  try {
    return JSON.parse(clientPayload);
  } catch {
    return {};
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = parseClientPayload(clientPayload);
        const sessionId = await getSessionId({ createIfMissing: true });
        const fileName = typeof payload.fileName === 'string' ? payload.fileName : 'upload-image';
        const safeName = fileName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'upload-image';

        return {
          pathname: `uploads/${sessionId}/${safeName}`,
          allowedContentTypes: ALLOWED_IMAGE_CONTENT_TYPES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ sessionId }),
        };
      },
      onUploadCompleted: async () => {
        // No-op for now: processing happens in the server action after submit.
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to prepare upload.',
      },
      { status: 400 }
    );
  }
}
