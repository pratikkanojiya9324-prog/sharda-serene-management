import { sortNotices } from './notices';

const n = (id: string, pinned: boolean, created_at: string) => ({ id, pinned, created_at });

describe('sortNotices', () => {
  it('puts pinned notices first, then newest first', () => {
    const sorted = sortNotices([
      n('old', false, '2026-11-01T10:00:00Z'),
      n('pinOld', true, '2026-10-01T10:00:00Z'),
      n('new', false, '2026-11-19T10:00:00Z'),
      n('pinNew', true, '2026-11-10T10:00:00Z'),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(['pinNew', 'pinOld', 'new', 'old']);
  });

  it('does not mutate the input', () => {
    const input = [n('a', false, '2026-11-01T00:00:00Z'), n('b', true, '2026-11-02T00:00:00Z')];
    sortNotices(input);
    expect(input.map((x) => x.id)).toEqual(['a', 'b']);
  });
});
