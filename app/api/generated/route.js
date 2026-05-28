import { NextResponse } from 'next/server';

import { clearGeneratedBatches } from '../../../lib/image-processing';
import { getSessionId } from '../../../lib/session';

export const runtime = 'nodejs';

export async function DELETE() {
  try {
    const sessionId = await getSessionId();

    if (sessionId) {
      await clearGeneratedBatches(sessionId);
    }

    return NextResponse.json({ error: null });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unable to clear generated files.',
      },
      { status: 500 }
    );
  }
}
