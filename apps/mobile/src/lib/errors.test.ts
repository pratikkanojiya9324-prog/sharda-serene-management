import { friendlyError } from './errors';

describe('friendlyError', () => {
  it.each([
    ['already_responded', 'This request was already answered'],
    ['visit_expired', 'This request expired — the guard will call you'],
    ['not_authorized', "You don't have access to this"],
    ['whatever', 'Something went wrong, try again'],
    ['toString', 'Something went wrong, try again'],
    ['already_paid', 'This bill is already marked paid'],
  ])('maps %s', (code, text) => expect(friendlyError(code)).toBe(text));
});
