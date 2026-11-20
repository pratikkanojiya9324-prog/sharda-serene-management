// Friendly text for the error codes the RPCs and the accounts function return.
const MESSAGES: Record<string, string> = {
  not_authorized: 'You are not allowed to do that.',
  invalid_password: 'Password must be at least 6 characters.',
  invalid_username: 'Username must be 3-30 characters: lowercase letters, digits, dot, dash or underscore.',
  invalid_name: 'Enter a name (at most 60 characters).',
  invalid_role: 'Choose a role.',
  username_taken: 'That username is already taken.',
  account_exists: 'This flat already has an account.',
  no_account: 'This flat has no account yet. Create one first.',
  cannot_disable_self: 'You cannot disable your own account.',
  still_member_elsewhere: 'Removed from this society; the login stays active for another society.',
  invalid_title: 'Enter a title.',
  invalid_body: 'Enter the notice text.',
  invalid_attachment: 'The attachment could not be used.',
  invalid_period: 'Choose a billing month.',
  invalid_amount: 'Enter an amount greater than 0.',
  invalid_due_date: 'Choose a due date.',
  invalid_rows: 'The bill rows are not valid.',
  already_paid: 'This bill is already paid.',
  invalid_payment_mode: 'Choose a payment mode.',
  unauthenticated: 'Your session has expired. Sign in again.',
};

export function friendlyError(e: unknown): string {
  const raw = typeof e === 'string' ? e : e instanceof Error ? e.message : ((e as { message?: string })?.message ?? String(e));
  for (const [code, text] of Object.entries(MESSAGES)) if (raw === code || raw.startsWith(`${code}:`)) return text;
  return raw;
}
