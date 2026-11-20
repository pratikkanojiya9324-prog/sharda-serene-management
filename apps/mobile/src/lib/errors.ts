const ERROR_TEXT: Record<string, string> = {
  already_responded: 'Already answered by another family member',
  visit_expired: 'This request expired — the guard will call you',
  not_authorized: "You don't have access to this",
  invalid_phone: 'Enter a valid 10-digit mobile number',
  invalid_validity: 'The end time must be after the start time',
  invalid_guest_name: 'Enter the guest name',
};

/** Maps an RPC error message (`error.message`) to resident-facing text. */
export function friendlyError(code: string): string {
  return ERROR_TEXT[code] ?? 'Something went wrong, try again';
}
