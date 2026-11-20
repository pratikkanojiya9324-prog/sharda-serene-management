export const MIN_PASSWORD_LENGTH = 6;

/** Validation text for the change-password form, or null when it can be saved. */
export function newPasswordError(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password !== confirm) return "The passwords don't match";
  return null;
}
