import { describe, expect, it } from 'vitest';
import { flatsText, todayStatus } from './dailyHelp';

const today = new Date(2026, 10, 23, 15, 0, 0);
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m, 0).toISOString();
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

describe('todayStatus', () => {
  it('open row today is Inside with the entry time', () => {
    const r = todayStatus([{ entry_at: at(23, 9, 5), exit_at: null }], today);
    expect(r).toEqual({ label: 'Inside', time: clock(at(23, 9, 5)) });
  });
  it('closed row today is Left with the exit time', () => {
    const r = todayStatus([{ entry_at: at(23, 8), exit_at: at(23, 11, 30) }], today);
    expect(r).toEqual({ label: 'Left', time: clock(at(23, 11, 30)) });
  });
  it('yesterday only is Not today', () => {
    expect(todayStatus([{ entry_at: at(22, 9), exit_at: at(22, 12) }], today)).toEqual({ label: 'Not today', time: null });
  });
  it('no rows is Not today', () => {
    expect(todayStatus([], today)).toEqual({ label: 'Not today', time: null });
  });
  it('an open row from yesterday is not counted as inside today', () => {
    expect(todayStatus([{ entry_at: at(22, 20), exit_at: null }], today).label).toBe('Not today');
  });
  it('uses the latest row today', () => {
    const rows = [
      { entry_at: at(23, 8), exit_at: at(23, 10) },
      { entry_at: at(23, 13), exit_at: null },
    ];
    expect(todayStatus(rows, today).label).toBe('Inside');
  });
});

describe('flatsText', () => {
  it('joins labels', () => expect(flatsText(['B1-A-101', 'B2-B-704'])).toBe('B1-A-101, B2-B-704'));
  it('sorts naturally', () => expect(flatsText(['B1-A-101', 'B1-A-9'])).toBe('B1-A-9, B1-A-101'));
  it('empty is a dash', () => expect(flatsText([])).toBe('—'));
});
