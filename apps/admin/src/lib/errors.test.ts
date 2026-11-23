import { describe, expect, it } from 'vitest';

import { friendlyError } from './errors';

describe('friendlyError', () => {
  it('maps the daily-help and parcel codes', () => {
    expect(friendlyError(new Error('code_generation_failed'))).toBe("Couldn't create a code, try again");
    expect(friendlyError({ message: 'helper_unlinked' })).toBe('This person is not linked to any flat.');
    expect(friendlyError('parcel_already_logged')).toBe('This delivery was already logged as a parcel.');
  });
  it('passes unknown messages through', () => {
    expect(friendlyError(new Error('boom'))).toBe('boom');
  });
});
