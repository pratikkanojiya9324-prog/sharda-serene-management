jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockRpc = jest.fn();
const mockEq = jest.fn();
jest.mock('./supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
    from: () => ({ select: () => ({ eq: (...a: unknown[]) => mockEq(...a) }) }),
  },
}));
jest.mock('./push', () => ({ registerPushToken: jest.fn(async () => 'ok') }));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearActorName, setActorName } from './actor';
import { bootstrapSignedInUser, markBatteryGuideShown } from './postLogin';

beforeEach(async () => {
  mockRpc.mockReset();
  mockEq.mockReset();
  await AsyncStorage.clear();
  await clearActorName();
  await markBatteryGuideShown();
});

describe('bootstrapSignedInUser', () => {
  it('no longer claims invites', async () => {
    mockEq.mockResolvedValue({ data: [{ role: 'guard' }], error: null });
    await bootstrapSignedInUser('u1');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('asks a resident who is using the phone when no name is stored', async () => {
    mockEq.mockResolvedValue({ data: [{ role: 'resident' }], error: null });
    const r = await bootstrapSignedInUser('u1');
    expect(r).toMatchObject({ home: '/(resident)', needsActorName: true, roles: ['resident'] });
  });

  it('does not ask again once a name is stored', async () => {
    await setActorName('Rahul');
    mockEq.mockResolvedValue({ data: [{ role: 'resident' }], error: null });
    expect((await bootstrapSignedInUser('u1')).needsActorName).toBe(false);
  });

  it('never asks staff', async () => {
    mockEq.mockResolvedValue({ data: [{ role: 'admin' }], error: null });
    expect(await bootstrapSignedInUser('u1')).toMatchObject({ home: '/(admin)', needsActorName: false });
  });
});
