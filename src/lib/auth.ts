'use server';

import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';

const USER_ID_COOKIE_NAME = 'chrono_anonymous_user_id';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Retrieves the anonymous user ID from cookies.
 * This function is async and intended to be used as a Server Action or within
 * other Server Actions/Components, allowing it to use `cookies()`.
 * The error "cookies() should be awaited" usually means the calling context
 * or the function itself needs to be async, which is already the case here.
 */
export async function getAnonymousUserId(): Promise<string> {
  const cookieStore = cookies();
  let userId = cookieStore.get(USER_ID_COOKIE_NAME)?.value;

  if (!userId) {
    userId = uuidv4();
    cookieStore.set(USER_ID_COOKIE_NAME, userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
    });
  }
  return userId;
}
