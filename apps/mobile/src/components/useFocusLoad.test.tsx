import { act, renderHook, waitFor } from '@testing-library/react-native';
jest.mock('expo-router', () => ({
  // Run the focus callback on mount, like a focused screen.
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks, @typescript-eslint/no-require-imports
    require('react').useEffect(cb, [cb]);
  },
}));
jest.mock('@/lib/signOut', () => ({ signOut: jest.fn() }));

import { useFocusLoad } from './resident';

describe('useFocusLoad', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('loaded after a load resolves', async () => {
    const load = jest.fn(async () => {});
    const { result } = await renderHook(() => useFocusLoad(load));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it('stays not loaded when load resolves false', async () => {
    const load = jest.fn(async () => false);
    const { result } = await renderHook(() => useFocusLoad(load));
    await waitFor(() => expect(load).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.loaded).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('surfaces an error string when load rejects', async () => {
    const load = jest.fn(async () => {
      throw new Error('storage unavailable');
    });
    const { result } = await renderHook(() => useFocusLoad(load));
    await waitFor(() => expect(result.current.error).toBe('Something went wrong, try again'));
    expect(result.current.loaded).toBe(false);
  });
});
