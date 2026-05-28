import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request) {
  const blobUrl = request.nextUrl.searchParams.get('url')?.trim();

  if (!blobUrl) {
    return NextResponse.json(
      { error: 'This route is deprecated. Download generated files from returned Blob URLs.' },
      { status: 410 }
    );
  }

  return NextResponse.redirect(blobUrl, { status: 307 });
}
