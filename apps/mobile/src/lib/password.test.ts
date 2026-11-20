import { newPasswordError } from './password';

describe('newPasswordError', () => {
  it('needs at least 6 characters', () => {
    expect(newPasswordError('12345', '12345')).toBe('Use at least 6 characters');
  });

  it('needs the confirmation to match', () => {
    expect(newPasswordError('secret1', 'secret2')).toBe("The passwords don't match");
  });

  it('accepts a valid matching password', () => {
    expect(newPasswordError('secret1', 'secret1')).toBeNull();
  });
});
