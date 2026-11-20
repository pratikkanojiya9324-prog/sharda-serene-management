jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockAuthSignOut = jest.fn();
jest.mock('./supabase', () => {
  const listeners: ((event: string) => void)[] = [];
  return {
    listeners,
    supabase: {
      auth: {
        signOut: (...a: unknown[]) => mockAuthSignOut(...a),
        onAuthStateChange: (cb: (event: string) => void) => {
          listeners.push(cb);
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
      },
    },
  };
});
jest.mock('./push', () => ({ unregisterPushToken: jest.fn(async () => {}) }));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { getActorName, setActorName } from './actor';
import { signOut } from './signOut';

const mockListeners: ((event: string) => void)[] = jest.requireMock('./supabase').listeners;
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  mockAuthSignOut.mockReset();
  mockAuthSignOut.mockResolvedValue({ error: null });
});

it('signs out and forgets who was using the phone', async () => {
  await setActorName('Rahul');
  await signOut();
  expect(mockAuthSignOut).toHaveBeenCalled();
  expect(await getActorName()).toBeNull();
});

it('still signs out when forgetting the name fails', async () => {
  await setActorName('Rahul');
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('disk full'));
  await expect(signOut()).resolves.toBeUndefined();
  expect(mockAuthSignOut).toHaveBeenCalled();
  expect(warn).toHaveBeenCalled();
  warn.mockRestore();
});

it('forgets the name whenever the session ends (e.g. refresh token revoked)', async () => {
  await setActorName('Rahul');
  expect(mockListeners.length).toBeGreaterThan(0);
  mockListeners.forEach((cb) => cb('TOKEN_REFRESHED'));
  await flush();
  expect(await getActorName()).toBe('Rahul');
  mockListeners.forEach((cb) => cb('SIGNED_OUT'));
  await flush();
  expect(await getActorName()).toBeNull();
});
