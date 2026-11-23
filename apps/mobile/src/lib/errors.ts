import { Alert } from 'react-native';

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
  // polls
  invalid_question: 'Enter the question',
  invalid_options: 'Add 2 to 6 options',
  invalid_choice: 'Choose an option',
  too_many_choices: 'You picked too many options',
  poll_closed: 'Voting has closed',
  already_voted: 'Your flat has already voted',
  remind_too_soon: 'A reminder was sent recently — try again later',
  invalid_time: 'Check the date and time',
  // amenities, events, contacts
  in_past: 'That time has already passed',
  too_far_ahead: 'You can book up to 14 days ahead',
  outside_hours: "It's closed at that time",
  bad_slot: 'Pick one of the listed slots',
  slot_taken: 'Someone just booked this slot — pick another',
  booking_limit: 'Your flat already has the maximum upcoming bookings for this',
  amenity_inactive: 'This is not open for booking right now',
  already_started: 'It has already started',
  not_pending: 'This booking was already decided',
  event_over: 'This event has already started',
  invalid_heads: 'Enter how many people (1–20)',
  invalid_contact_phone: 'Enter a valid phone number',
  // admin actions
  invalid_title: 'Give the notice a title',
  invalid_attachment: 'The attachment could not be added, try again',
  invalid_status: 'Choose a status',
  invalid_payment_mode: 'Choose how the bill was paid',
  already_paid: 'This bill is already marked paid',
  // SOS
  sos_closed: 'This alert is already closed',
  invalid_note: 'Note is too long',
  // daily help, expected entries, parcels
  invalid_name: 'Enter a name',
  helper_already_linked: 'This person is already added to your flat',
  helper_inactive: 'This person has been blocked by the society office',
  already_inside: 'Already checked in',
  not_inside: 'Not checked in yet',
  invalid_hours: 'Choose how long',
  invalid_purpose: 'Choose what you are expecting',
  invalid_company: 'Company name is too long',
  already_cancelled: 'Already cancelled',
  invalid_courier: 'Enter the courier name',
  already_collected: 'This parcel was already handed over',
  helper_unlinked: 'This person is not linked to any flat',
  parcel_already_logged: 'This delivery was already logged as a parcel',
  invalid_type: 'Choose a type',
  invalid_active: 'Something went wrong, try again',
  code_generation_failed: "Couldn't create a code, try again",
  'Network request failed': 'No internet connection, try again',
  'Failed to fetch': 'No internet connection, try again',
};

/** Maps an RPC error message (`error.message`) to resident-facing text. */
export function friendlyError(code: string): string {
  return Object.hasOwn(ERROR_TEXT, code) ? ERROR_TEXT[code] : 'Something went wrong, try again';
}

/** True when the code has its own friendly text (so callers can fall back to something else). */
export function hasFriendlyError(code: string): boolean {
  return Object.hasOwn(ERROR_TEXT, code);
}

/** The session is gone (expired JWT / revoked refresh token): the user must log in again. */
export function isSessionExpired(e: { message?: string; code?: string } | null): boolean {
  if (!e) return false;
  if (e.code === 'PGRST301') return true;
  const m = e.message ?? '';
  return m.includes('JWT expired') || m.includes('Invalid Refresh Token') || m.includes('refresh_token_not_found');
}

// Several requests fail together when the login expires: alert and sign out once.
let handlingExpiry = false;

/**
 * Turns any Supabase error into user-facing text. An expired login additionally
 * shows a one-time alert and signs out (the root layout then routes to login).
 */
export function reportError(e: { message?: string; code?: string } | null): string {
  if (isSessionExpired(e)) {
    if (!handlingExpiry) {
      handlingExpiry = true;
      Alert.alert('Login expired', 'Please log in again.');
      // Lazy: signOut pulls in the Supabase client, which pure text mapping must not need.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { signOut } = require('./signOut') as typeof import('./signOut');
      signOut()
        .catch((err) => console.warn('[reportError] sign-out failed', err))
        .finally(() => {
          handlingExpiry = false;
        });
    }
    return 'Please log in again';
  }
  return friendlyError(e?.message ?? '');
}
