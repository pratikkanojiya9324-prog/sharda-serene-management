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
