import 'server-only';

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'photo_compressor_session';
const SESSION_ID_PATTERN = /^[a-f0-9-]{36}$/;
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60;

function isValidSessionId(value) {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

function writeSessionCookie(store, sessionId) {
  store.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
}

export async function getSessionId(options = {}) {
  const { createIfMissing = false } = options;
  const store = await cookies();
  const existingSessionId = store.get(SESSION_COOKIE_NAME)?.value;

  if (isValidSessionId(existingSessionId)) {
    writeSessionCookie(store, existingSessionId);
    return existingSessionId;
  }

  if (!createIfMissing) {
    return null;
  }

  const nextSessionId = randomUUID();
  writeSessionCookie(store, nextSessionId);
  return nextSessionId;
}