import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function DELETE() {
  try {
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
