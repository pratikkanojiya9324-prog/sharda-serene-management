import { mergeVisit, type Visit } from './visitMerge';

const base: Visit = {
  id: 'v1',
  created_at: '2026-11-20T10:00:00Z',
  society_id: 's1',
  flat_id: 'f1',
  name: 'Ravi',
  phone: null,
  photo_path: null,
  purpose: 'delivery',
  status: 'pending',
  responded_by: null,
  responded_at: null,
  responded_by_name: null,
  manual_outcome: null,
  created_by: 'g1',
  pass_id: null,
  entry_at: null,
  exit_at: null,
  expected_entry_id: null,
};

describe('mergeVisit', () => {
  it('takes the incoming row when there is none yet', () => {
    expect(mergeVisit(null, base)).toBe(base);
  });

  it('applies a newer answer', () => {
    const approved = { ...base, status: 'approved' as const, responded_by: 'r1', responded_at: 'x' };
    expect(mergeVisit(base, approved)).toEqual(approved);
  });

  it('ignores a stale pending copy after an answer arrived', () => {
    const approved = { ...base, status: 'approved' as const, responded_by: 'r1', responded_at: 'x' };
    const merged = mergeVisit(approved, base);
    expect(merged.status).toBe('approved');
    expect(merged.responded_by).toBe('r1');
  });

  it('never clears set-once fields', () => {
    const entered = { ...base, status: 'approved' as const, entry_at: 'e', photo_path: 'p', manual_outcome: 'allowed' as const };
    const stale = { ...base, status: 'approved' as const };
    const merged = mergeVisit(entered, stale);
    expect(merged.entry_at).toBe('e');
    expect(merged.photo_path).toBe('p');
    expect(merged.manual_outcome).toBe('allowed');
  });

  it('replaces the row when the id differs', () => {
    const other = { ...base, id: 'v2' };
    expect(mergeVisit(base, other)).toBe(other);
  });
});
