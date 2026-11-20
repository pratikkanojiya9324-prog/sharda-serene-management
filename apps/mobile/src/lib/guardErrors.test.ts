import { guardErrorText } from './guardErrors';

describe('guardErrorText', () => {
  it.each([
    ['not_authorized', 'You are not allowed to do that. Ask your admin to check your guard access.'],
    ['not_allowed_in', 'This visitor has not been approved to enter.'],
    ['not_entered', 'This visitor has not entered yet.'],
    ['already_responded', 'The resident already responded.'],
    ['Network request failed', 'No internet connection. Check the network and try again.'],
  ])('maps %s', (msg, text) => expect(guardErrorText(msg)).toBe(text));

  it('never shows a raw code', () => {
    expect(guardErrorText('PGRST116')).toBe('Something went wrong. Try again.');
    expect(guardErrorText(undefined)).toBe('Something went wrong. Try again.');
  });
});
