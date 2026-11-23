import { guardErrorText } from './guardErrors';

describe('guardErrorText', () => {
  it.each([
    ['not_authorized', 'You are not allowed to do that. Ask your admin to check your guard access.'],
    ['not_allowed_in', 'This visitor has not been approved to enter.'],
    ['not_entered', 'This visitor has not entered yet.'],
    ['already_responded', 'The resident already responded.'],
    ['sos_closed', 'This SOS is already closed'],
    ['invalid_note', 'The note is too long (300 characters at most)'],
    ['Network request failed', 'No internet connection. Check the network and try again.'],
  ])('maps %s', (msg, text) => expect(guardErrorText(msg)).toBe(text));

  it('falls back to the shared error copy for codes it has no entry for', () => {
    expect(guardErrorText('already_inside')).toBe('Already checked in');
    expect(guardErrorText('not_inside')).toBe('Not checked in yet');
  });

  it('never shows a raw code', () => {
    expect(guardErrorText('PGRST116')).toBe('Something went wrong. Try again.');
    expect(guardErrorText(undefined)).toBe('Something went wrong. Try again.');
  });
});
