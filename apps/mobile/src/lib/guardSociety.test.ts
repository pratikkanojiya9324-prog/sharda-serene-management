import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockLimit = jest.fn();
jest.mock('./supabase', () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => mockLimit(),
  };
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'guard-1' } } } }) },
      from: () => chain,
    },
  };
});

import { useGuardSociety } from './guardSociety';

describe('useGuardSociety', () => {
  beforeEach(() => mockLimit.mockReset());

  it('reports a failed lookup and recovers on reload', async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'TypeError: Network request failed' } });
    mockLimit.mockResolvedValueOnce({ data: [{ society_id: 'soc-1' }], error: null });
    const { result } = await renderHook(() => useGuardSociety());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.societyId).toBeNull();

    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.societyId).toBe('soc-1'));
    expect(result.current.error).toBeNull();
  });

  it('turns a thrown lookup into an error instead of staying blank', async () => {
    mockLimit.mockRejectedValueOnce(new Error('boom'));
    const { result } = await renderHook(() => useGuardSociety());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.societyId).toBeNull();
  });
});
