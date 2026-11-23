import { friendlyError, hasFriendlyError } from './errors';

const GUARD_ERROR_TEXT: Record<string, string> = {
  not_authorized: 'You are not allowed to do that. Ask your admin to check your guard access.',
  not_allowed_in: 'This visitor has not been approved to enter.',
  not_entered: 'This visitor has not entered yet.',
  already_responded: 'The resident already responded.',
  'Network request failed': 'No internet connection. Check the network and try again.',
  'Failed to fetch': 'No internet connection. Check the network and try again.',
};

const GENERIC = 'Something went wrong. Try again.';

/** Maps an RPC / network error message to guard-facing text (never a raw code). */
export function guardErrorText(message: string | null | undefined): string {
  if (!message) return GENERIC;
  if (Object.hasOwn(GUARD_ERROR_TEXT, message)) return GUARD_ERROR_TEXT[message];
  return hasFriendlyError(message) ? friendlyError(message) : GENERIC;
}
