import { describe, expect, it } from 'vitest';

import { friendlyError } from './errors';

describe('friendlyError', () => {
  it('maps the daily-help and parcel codes', () => {
    expect(friendlyError(new Error('code_generation_failed'))).toBe("Couldn't create a code, try again");
    expect(friendlyError({ message: 'helper_unlinked' })).toBe('This person is not linked to any flat.');
    expect(friendlyError('parcel_already_logged')).toBe('This delivery was already logged as a parcel.');
  });
  it('maps the amenity, event, document and SOS codes to the spec copy', () => {
    expect(friendlyError(new Error('not_pending'))).toBe('This booking was already decided');
    expect(friendlyError({ message: 'sos_closed' })).toBe('This alert is already closed');
    expect(friendlyError('invalid_note')).toBe('Note is too long');
    expect(friendlyError('invalid_limit: 11')).toBe('Choose a number from 1 to 10');
    expect(friendlyError('slot_taken')).toBe('Someone just booked this slot — pick another');
    expect(friendlyError('outside_hours')).toBe("It's closed at that time");
  });
  it('passes unknown messages through', () => {
    expect(friendlyError(new Error('boom'))).toBe('boom');
  });
});
