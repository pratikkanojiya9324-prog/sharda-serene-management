const mockSignIn = jest.fn();
const mockRpc = jest.fn();
jest.mock('./supabase', () => ({
  supabase: {
    auth: { signInWithPassword: (...a: unknown[]) => mockSignIn(...a) },
    rpc: (...a: unknown[]) => mockRpc(...a),
  },
}));

import {
  groupDirectory,
  loadDirectory,
  loginErrorText,
  signInFlat,
  signInStaff,
  welcomeTitle,
  type DirectoryFlat,
} from './flatLogin';

const SOCIETY = '0de30da4-35c7-4df4-9d7b-6490f04ae6f3';
const flat: DirectoryFlat = { flat_id: 'f-1', building: 'Building 1', wing: 'A', flat_number: '101' };
const wrongPassword = {
  name: 'AuthApiError',
  status: 400,
  code: 'invalid_credentials',
  message: 'Invalid login credentials',
};

beforeEach(() => {
  mockSignIn.mockReset();
  mockRpc.mockReset();
});

describe('signInFlat', () => {
  it('signs in with the flat account email and the typed password', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: null });
    expect(await signInFlat(flat, 'Sharda@1A101')).toBeNull();
    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'flat-f-1@login.societygate.app',
      password: 'Sharda@1A101',
    });
  });

  it('names the flat when the password is wrong', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: wrongPassword });
    expect(await signInFlat(flat, 'nope')).toBe('Wrong password for B1-A-101');
  });

  it('says the server is unreachable on a network failure', async () => {
    mockSignIn.mockResolvedValue({
      data: {},
      error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' },
    });
    expect(await signInFlat(flat, 'x')).toBe("Can't reach the server");
  });

  it('says the server is unreachable when the request throws', async () => {
    mockSignIn.mockRejectedValue(new TypeError('Network request failed'));
    expect(await signInFlat(flat, 'x')).toBe("Can't reach the server");
  });
});

describe('signInStaff', () => {
  it('signs in with the staff email for this society (username trimmed and lowercased)', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: null });
    expect(await signInStaff(' Guard1 ', 'Guard@123', SOCIETY)).toBeNull();
    expect(mockSignIn).toHaveBeenCalledWith({
      email: `guard1@staff.${SOCIETY}.societygate.app`,
      password: 'Guard@123',
    });
  });

  it('rejects an invalid username without calling the server', async () => {
    expect(await signInStaff('a b', 'x', SOCIETY)).toBe('Enter a valid username');
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it('reports a wrong username or password', async () => {
    mockSignIn.mockResolvedValue({ data: {}, error: wrongPassword });
    expect(await signInStaff('admin', 'bad', SOCIETY)).toBe('Wrong username or password');
  });
});

describe('loginErrorText', () => {
  it('says a banned account is disabled', () => {
    expect(loginErrorText({ status: 400, code: 'user_banned', message: 'User is banned' }, 'x')).toBe(
      'This account has been disabled',
    );
  });
  it('asks to wait when rate limited', () => {
    expect(loginErrorText({ status: 429, message: 'rate limit' }, 'x')).toBe(
      'Too many attempts. Wait a minute and try again',
    );
  });
  it('falls back to a generic message', () => {
    expect(loginErrorText({ status: 500, message: 'boom' }, 'x')).toBe('Something went wrong, try again');
  });
});

describe('loadDirectory', () => {
  it('returns the society name and flats', async () => {
    mockRpc.mockResolvedValue({ data: [{ society_name: 'Sharda Serene', ...flat }], error: null });
    expect(await loadDirectory(SOCIETY)).toEqual({ status: 'ok', societyName: 'Sharda Serene', flats: [flat] });
    expect(mockRpc).toHaveBeenCalledWith('login_directory', { p_society_id: SOCIETY });
  });

  it('is not configured without a society id, with a malformed one, or when the society has no flats', async () => {
    expect(await loadDirectory(undefined)).toEqual({ status: 'not_configured' });
    expect(await loadDirectory('not-a-uuid')).toEqual({ status: 'not_configured' });
    expect(mockRpc).not.toHaveBeenCalled();
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await loadDirectory(SOCIETY)).toEqual({ status: 'not_configured' });
  });

  it('is offline when the server cannot be reached', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'TypeError: Network request failed', code: '' } });
    expect(await loadDirectory(SOCIETY)).toEqual({ status: 'offline' });
    mockRpc.mockRejectedValue(new TypeError('Network request failed'));
    expect(await loadDirectory(SOCIETY)).toEqual({ status: 'offline' });
  });

  it('offers a retry (offline) for any other server error, not the dead-end not-configured card', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'boom', code: '500' } });
    expect(await loadDirectory(SOCIETY)).toEqual({ status: 'offline' });
  });
});

describe('groupDirectory', () => {
  const f = (building: string, wing: string, flat_number: string): DirectoryFlat => ({
    flat_id: `${building}${wing}${flat_number}`,
    building,
    wing,
    flat_number,
  });

  it('lists buildings, wings and flats in natural order', () => {
    const g = groupDirectory([
      f('Building 10', 'A', '101'),
      f('Building 2', 'B', '1001'),
      f('Building 2', 'A', '201'),
      f('Building 2', 'A', '101'),
      f('Building 2', 'B', '102'),
    ]);
    expect(g.buildings).toEqual(['Building 2', 'Building 10']);
    expect(g.wings('Building 2')).toEqual(['A', 'B']);
    expect(g.flats('Building 2', 'B').map((x) => x.flat_number)).toEqual(['102', '1001']);
    expect(g.wings('Building 9')).toEqual([]);
    expect(g.flats('Building 2', 'C')).toEqual([]);
  });
});

describe('welcomeTitle', () => {
  it('greets the families of the society by its first word', () => {
    expect(welcomeTitle('Sharda Serene')).toBe('Welcome Sharda family members');
    expect(welcomeTitle('  Lotus ')).toBe('Welcome Lotus family members');
  });
});
