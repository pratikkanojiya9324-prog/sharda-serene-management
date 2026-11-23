const mockSignOut = jest.fn(async () => {});
jest.mock('./signOut', () => ({ signOut: () => mockSignOut() }));
jest.mock('react-native', () => ({ Alert: { alert: jest.fn() } }));

import { Alert } from 'react-native';

import { friendlyError, isSessionExpired, reportError } from './errors';

describe('friendlyError', () => {
  it.each([
    ['already_responded', 'This request was already answered'],
    ['visit_expired', 'This request expired — the guard will call you'],
    ['not_authorized', "You don't have access to this"],
    ['whatever', 'Something went wrong, try again'],
    ['toString', 'Something went wrong, try again'],
    ['already_paid', 'This bill is already marked paid'],
    ['invalid_name', 'Enter a name'],
    ['helper_already_linked', 'This person is already added to your flat'],
    ['helper_inactive', 'This person has been blocked by the society office'],
    ['already_inside', 'Already checked in'],
    ['not_inside', 'Not checked in yet'],
    ['invalid_hours', 'Choose how long'],
    ['invalid_purpose', 'Choose what you are expecting'],
    ['invalid_company', 'Company name is too long'],
    ['already_cancelled', 'Already cancelled'],
    ['invalid_courier', 'Enter the courier name'],
    ['already_collected', 'This parcel was already handed over'],
    ['invalid_type', 'Choose a type'],
    ['invalid_active', 'Something went wrong, try again'],
    ['code_generation_failed', "Couldn't create a code, try again"],
    ['invalid_photo_path', 'The photo could not be attached, try again'],
    ['Network request failed', 'No internet connection, try again'],
    ['Failed to fetch', 'No internet connection, try again'],
  ])('maps %s', (code, text) => expect(friendlyError(code)).toBe(text));
});

describe('isSessionExpired', () => {
  it.each([
    [{ code: 'PGRST301' }, true],
    [{ message: 'JWT expired' }, true],
    [{ message: 'Invalid Refresh Token: Refresh Token Not Found' }, true],
    [{ message: 'refresh_token_not_found' }, true],
    [{ message: 'already_paid' }, false],
    [{}, false],
    [null, false],
  ])('%j -> %s', (e, expected) => expect(isSessionExpired(e)).toBe(expected));
});

describe('reportError', () => {
  const flush = () => new Promise((r) => setTimeout(r, 0));
  beforeEach(() => {
    mockSignOut.mockClear();
    (Alert.alert as jest.Mock).mockClear();
  });

  it('returns friendly text for ordinary errors without signing out', () => {
    expect(reportError({ message: 'already_paid' })).toBe('This bill is already marked paid');
    expect(reportError(null)).toBe('Something went wrong, try again');
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('on expiry alerts once, signs out once and asks to log in again', async () => {
    expect(reportError({ code: 'PGRST301', message: 'JWT expired' })).toBe('Please log in again');
    expect(reportError({ message: 'JWT expired' })).toBe('Please log in again');
    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith('Login expired', 'Please log in again.');
    await flush();
    // a later session can expire again
    reportError({ message: 'JWT expired' });
    expect(mockSignOut).toHaveBeenCalledTimes(2);
  });
});
