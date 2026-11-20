import { flatEmail, flatLabel, isValidUsername, staffEmail } from '@society-gate/shared';

import { naturalCompare } from './flatPicker';
import { supabase } from './supabase';

// Sign-in for flat accounts (Building/Wing/Flat + password) and staff accounts
// (username + password). The synthetic login emails are built here and never shown.

export type DirectoryFlat = { flat_id: string; building: string; wing: string; flat_number: string };

export type Directory =
  | { status: 'ok'; societyName: string; flats: DirectoryFlat[] }
  /** No/invalid EXPO_PUBLIC_SOCIETY_ID, or that society has no flats. */
  | { status: 'not_configured' }
  /** Server unreachable or returned an error: retryable. */
  | { status: 'offline' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NETWORK_TEXT = "Can't reach the server";

type AuthErrorLike = { name?: string; status?: number; code?: string; message?: string };

const isNetworkFailure = (e: { name?: string; status?: number; message?: string }) =>
  e.name === 'AuthRetryableFetchError' ||
  e.status === 0 ||
  /network request failed|failed to fetch|fetch failed/i.test(e.message ?? '');

/** Login error -> user-facing text. `wrongCredentialsText` names what was wrong. */
export function loginErrorText(error: AuthErrorLike, wrongCredentialsText: string): string {
  if (isNetworkFailure(error)) return NETWORK_TEXT;
  if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message ?? '')) {
    return wrongCredentialsText;
  }
  if (error.code === 'user_banned') return 'This account has been disabled';
  if (error.status === 429) return 'Too many attempts. Wait a minute and try again';
  return 'Something went wrong, try again';
}

/** Returns null on success, else the message to show. */
async function signIn(email: string, password: string, wrongCredentialsText: string): Promise<string | null> {
  try {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? loginErrorText(error, wrongCredentialsText) : null;
  } catch {
    return NETWORK_TEXT;
  }
}

export function signInFlat(flat: DirectoryFlat, password: string): Promise<string | null> {
  const label = flatLabel(flat.building, flat.wing, flat.flat_number);
  return signIn(flatEmail(flat.flat_id), password, `Wrong password for ${label}`);
}

export async function signInStaff(username: string, password: string, societyId: string): Promise<string | null> {
  const u = username.trim().toLowerCase();
  if (!isValidUsername(u)) return 'Enter a valid username';
  return signIn(staffEmail(u, societyId), password, 'Wrong username or password');
}

/** The society's name and flats for the welcome screen (anon RPC; no personal data). */
export async function loadDirectory(societyId: string | undefined): Promise<Directory> {
  if (!societyId || !UUID.test(societyId)) return { status: 'not_configured' };
  try {
    const { data, error } = await supabase.rpc('login_directory', { p_society_id: societyId });
    // Any server error (network, timeout, 5xx) is retryable; only a missing/malformed id or an
    // empty society means the build itself is not configured.
    if (error) return { status: 'offline' };
    if (!data || data.length === 0) return { status: 'not_configured' };
    return {
      status: 'ok',
      societyName: data[0].society_name,
      flats: data.map(({ flat_id, building, wing, flat_number }) => ({ flat_id, building, wing, flat_number })),
    };
  } catch {
    return { status: 'offline' };
  }
}

const uniqueSorted = (values: string[]) => [...new Set(values)].sort(naturalCompare);

/** Building -> Wing -> Flat choices, each level in natural order (Building 2 before Building 10). */
export function groupDirectory(flats: DirectoryFlat[]) {
  return {
    buildings: uniqueSorted(flats.map((f) => f.building)),
    wings: (building: string) => uniqueSorted(flats.filter((f) => f.building === building).map((f) => f.wing)),
    flats: (building: string, wing: string) =>
      flats
        .filter((f) => f.building === building && f.wing === wing)
        .sort((a, b) => naturalCompare(a.flat_number, b.flat_number)),
  };
}

/** "Sharda Serene" -> "Welcome Sharda family members". */
export function welcomeTitle(societyName: string): string {
  const first = societyName.trim().split(/\s+/)[0] ?? '';
  return `Welcome ${first} family members`;
}
