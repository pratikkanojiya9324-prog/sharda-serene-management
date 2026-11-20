const PASS_ERROR_TEXT: Record<string, string> = {
  invalid_code: 'Code not found',
  pass_revoked: 'This pass was cancelled',
  pass_not_yet_valid: 'This pass is not active yet',
  pass_expired: 'This pass has expired',
  not_authorized: 'You are not allowed to use pass codes',
};

/** Maps an RPC error message from `use_pass` to guard-facing text. */
export function passErrorText(message: string): string {
  return PASS_ERROR_TEXT[message] ?? 'Something went wrong. Try again.';
}
