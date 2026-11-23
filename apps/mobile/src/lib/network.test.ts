import { isOnline } from './network';

describe('isOnline', () => {
  it.each([
    [{ isConnected: false, isInternetReachable: false }, false],
    [{ isConnected: false }, false],
    [{ isConnected: true, isInternetReachable: false }, false],
    [{ isConnected: true, isInternetReachable: null }, true],
    [{ isConnected: true, isInternetReachable: true }, true],
    [{ isConnected: null, isInternetReachable: null }, true],
  ])('%j -> %s', (state, expected) => expect(isOnline(state)).toBe(expected));
});
