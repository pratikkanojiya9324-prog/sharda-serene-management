const ERROR_TEXT: Record<string, string> = {
  already_responded: 'This request was already answered',
  visit_expired: 'This request expired — the guard will call you',
  not_authorized: "You don't have access to this",
  invalid_phone: 'Enter a valid 10-digit mobile number',
  invalid_validity: 'The end time must be after the start time',
  invalid_guest_name: 'Enter the guest name',
  invalid_category: 'Choose a category',
  invalid_description: 'Describe the problem',
  invalid_body: 'Write a message first',
  invalid_photo_path: 'The photo could not be attached, try again',
  invalid_actor_name: 'Your name is too long — change it from More',
  // admin actions
  invalid_title: 'Give the notice a title',
  invalid_attachment: 'The attachment could not be added, try again',
  invalid_status: 'Choose a status',
  invalid_payment_mode: 'Choose how the bill was paid',
  already_paid: 'This bill is already marked paid',
  'Network request failed': 'No internet connection, try again',
};

/** Maps an RPC error message (`error.message`) to resident-facing text. */
export function friendlyError(code: string): string {
  return Object.hasOwn(ERROR_TEXT, code) ? ERROR_TEXT[code] : 'Something went wrong, try again';
}
