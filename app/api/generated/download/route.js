import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';

import { getGeneratedBatchFiles, getGeneratedFilePath } from '../../../../lib/image-processing';
import { getSessionId } from '../../../../lib/session';

export const runtime = 'nodejs';

function badRequest(error) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET(request) {
  const batchId = request.nextUrl.searchParams.get('batchId')?.trim();
  const fileName = request.nextUrl.searchParams.get('file')?.trim();

  if (!batchId) {
    return badRequest('A batchId query parameter is required.');
  }

  try {
    const sessionId = await getSessionId();

    if (!sessionId) {
      return badRequest('No active session found for generated images.');
    }

    if (fileName) {
      const filePath = getGeneratedFilePath(sessionId, batchId, fileName);

      if (!filePath) {
        return badRequest('The requested file is invalid.');
      }

      const fileStat = await stat(filePath).catch(() => null);

      if (!fileStat || !fileStat.isFile()) {
        return NextResponse.json({ error: 'The requested file was not found.' }, { status: 404 });
      }

      return new Response(Readable.toWeb(createReadStream(filePath)), {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${basename(fileName)}"`,
          'Content-Length': String(fileStat.size),
          'Cache-Control': 'no-store',
        },
      });
    }

    const batchFiles = await getGeneratedBatchFiles(sessionId, batchId);

    if (batchFiles.length === 0) {
      return NextResponse.json({ error: 'No generated files were found for this batch.' }, { status: 404 });
    }

    const archiverModule = await import('archiver');
    const zip =
      typeof archiverModule.ZipArchive === 'function'
        ? new archiverModule.ZipArchive({ zlib: { level: 9 } })
        : typeof archiverModule.default === 'function'
          ? archiverModule.default('zip', { zlib: { level: 9 } })
          : typeof archiverModule.archiver === 'function'
            ? archiverModule.archiver('zip', { zlib: { level: 9 } })
            : typeof archiverModule === 'function'
              ? archiverModule('zip', { zlib: { level: 9 } })
              : null;

    if (!zip) {
      throw new Error('Unable to initialize zip archive generator.');
    }

    for (const file of batchFiles) {
      const fileStat = await stat(file.absolutePath).catch(() => null);

      if (!fileStat || !fileStat.isFile()) {
        continue;
      }

      zip.append(createReadStream(file.absolutePath), {
        name: basename(file.name),
        date: new Date(fileStat.mtimeMs),
      });
    }

    const safeBatchId = batchId.replace(/[^a-z0-9-]/gi, '-').slice(0, 80) || 'batch';

    const webStream = Readable.toWeb(zip);

    queueMicrotask(() => {
      zip.finalize().catch(() => {
        zip.destroy();
      });
    });

    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="resized-images-${safeBatchId}.zip"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to create zip download.',
      },
      { status: 500 }
    );
  }
}
