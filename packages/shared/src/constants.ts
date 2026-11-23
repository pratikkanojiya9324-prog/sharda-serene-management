export const CALL_BUTTON_AFTER_MS = 60_000;
export const VISIT_EXPIRY_MINUTES = 10;
export const PASS_CODE_LENGTH = 6;

export type HelperType = 'maid' | 'cook' | 'driver' | 'nanny' | 'car_cleaner' | 'tutor' | 'other';

export const HELPER_TYPES: { value: HelperType; label: string }[] = [
  { value: 'maid', label: 'Maid' },
  { value: 'cook', label: 'Cook' },
  { value: 'driver', label: 'Driver' },
  { value: 'nanny', label: 'Nanny' },
  { value: 'car_cleaner', label: 'Car cleaner' },
  { value: 'tutor', label: 'Tutor' },
  { value: 'other', label: 'Other' },
];

export type ExpectedPurpose = 'delivery' | 'cab' | 'service' | 'guest';

export const EXPECTED_COMPANIES = [
  'Swiggy', 'Zomato', 'Amazon', 'Flipkart', 'Blinkit', 'Zepto', 'Uber', 'Ola', 'Rapido', 'Other',
] as const;

export const COURIERS = [
  'Amazon', 'Flipkart', 'Myntra', 'Meesho', 'Delhivery', 'Blue Dart', 'DTDC', 'India Post', 'Other',
] as const;

/** Allowed validity windows (hours) for an expected entry. */
export const EXPECTED_HOURS = [1, 2, 4, 8] as const;

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;
export const POLL_REMIND_HOURS = 6;

export const SLOT_MINUTES = [30, 60, 120, 240, 1440] as const;
export const BOOKING_DAYS_AHEAD = 14;
