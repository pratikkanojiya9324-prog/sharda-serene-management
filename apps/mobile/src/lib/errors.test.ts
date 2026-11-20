import { friendlyError } from './errors';

describe('friendlyError', () => {
  it.each([
    ['already_responded', 'Already answered by another family member'],
    ['visit_expired', 'This request expired — the guard will call you'],
    ['not_authorized', "You don't have access to this"],
    ['whatever', 'Something went wrong, try again'],
  ])('maps %s', (code, text) => expect(friendlyError(code)).toBe(text));
});
