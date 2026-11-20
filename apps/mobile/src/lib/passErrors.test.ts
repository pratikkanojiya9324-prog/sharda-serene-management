import { passErrorText } from './passErrors';

describe('passErrorText', () => {
  it.each([
    ['invalid_code', 'Code not found'],
    ['pass_revoked', 'This pass was cancelled'],
    ['pass_not_yet_valid', 'This pass is not active yet'],
    ['pass_expired', 'This pass has expired'],
    ['not_authorized', 'You are not allowed to use pass codes'],
  ])('maps %s', (msg, text) => expect(passErrorText(msg)).toBe(text));

  it('falls back to a generic message', () => {
    expect(passErrorText('boom')).toBe('Something went wrong. Try again.');
  });
});
