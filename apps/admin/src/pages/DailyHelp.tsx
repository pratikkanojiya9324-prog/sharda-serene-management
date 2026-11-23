import { useCallback, useEffect, useRef, useState } from 'react';
import { HELPER_GUARD_SELECT, HELPER_TYPES, flatLabel } from '@society-gate/shared';
import { useToast } from '../components/Toast';
import { Button, Card, ConfirmDialog, EmptyState, ErrorBanner, PageHeader, Pill, SearchInput, Table, td, th, type Tone } from '../components/ui';
import { flatsText, todayStatus, type TodayLabel } from '../lib/dailyHelp';
import { friendlyError } from '../lib/errors';
import { SOCIETY_ID, supabase } from '../lib/supabase';

const TYPE_LABEL = new Map<string, string>(HELPER_TYPES.map((t) => [t.value, t.label]));
const STATUS_TONE: Record<TodayLabel, Tone> = { Inside: 'green', Left: 'slate', 'Not today': 'amber' };

export default function DailyHelp() {
  const toast = useToast();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchHelpers>>['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState<{ id: string; name: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const { data, error: err } = await fetchHelpers();
    if (seq !== loadSeq.current) return;
    if (err) return setError(err.message);
    setError(null);
    setRows(data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setActive(id: string, active: boolean) {
    setBusyId(id);
    const { error: err } = await supabase.rpc('set_helper_active', { p_helper_id: id, p_active: active });
    setBusyId(null);
    setConfirm(null);
    if (err) return toast('error', friendlyError(err));
    toast('success', active ? 'Helper activated' : 'Helper deactivated');
    void load();
  }

  const now = new Date();
  const s = search.trim().toLowerCase();
  const shown = (rows ?? []).filter((h) => !s || h.name.toLowerCase().includes(s) || h.phone.includes(s) || h.entry_code.includes(s));

  return (
    <>
      <PageHeader title="Daily help" subtitle="Maids, cooks, drivers and others registered by flats. Deactivate to block entry." />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or code" />
          <span className="ml-auto text-sm text-slate-500">{shown.length} shown</span>
        </div>
        {rows && shown.length === 0 ? (
          <EmptyState icon="users" title="No daily help">
            {rows.length === 0 ? 'Flats have not added anyone yet.' : 'Nothing matches your search.'}
          </EmptyState>
        ) : (
          <Table
            head={
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Type</th>
                <th className={th}>Phone</th>
                <th className={th}>Code</th>
                <th className={th}>Flats</th>
                <th className={th}>Today</th>
                <th className={th}>Active</th>
              </tr>
            }
          >
            {shown.map((h) => {
              const st = todayStatus(h.helper_attendance, now);
              return (
                <tr key={h.id} className="hover:bg-slate-50/60">
                  <td className={`${td} font-medium text-slate-900`}>{h.name}</td>
                  <td className={td}>{TYPE_LABEL.get(h.type) ?? h.type}</td>
                  <td className={`${td} whitespace-nowrap`}>{h.phone}</td>
                  <td className={`${td} font-mono tracking-wider`}>{h.entry_code}</td>
                  <td className={`${td} max-w-xs text-slate-600`}>{flatsText(h.flatLabels)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {h.active ? (
                      <Pill tone={STATUS_TONE[st.label]}>
                        {st.label}
                        {st.time && ` · ${st.time}`}
                      </Pill>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className={td}>
                    {h.active ? (
                      <Button size="sm" variant="secondary" busy={busyId === h.id} onClick={() => setConfirm({ id: h.id, name: h.name })}>
                        Deactivate
                      </Button>
                    ) : (
                      <Button size="sm" busy={busyId === h.id} onClick={() => void setActive(h.id, true)}>
                        Activate
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      <ConfirmDialog
        open={!!confirm}
        title="Deactivate daily help?"
        message={`${confirm?.name ?? 'This person'} will be blocked at the gate and their entry code stops working. You can activate them again later.`}
        confirmLabel="Deactivate"
        danger
        busy={!!confirm && busyId === confirm.id}
        onConfirm={() => confirm && void setActive(confirm.id, false)}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}

/** Helpers with their flats; the embedded attendance is limited to today's rows. */
async function fetchHelpers() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('helpers')
    .select(HELPER_GUARD_SELECT)
    .eq('society_id', SOCIETY_ID)
    .gte('helper_attendance.entry_at', start.toISOString())
    .order('name')
    .order('id');
  const list = (data ?? []).map((h) => ({
    ...h,
    flatLabels: (h.helper_flats ?? []).map((hf) => flatLabel(hf.flats?.towers?.building ?? '', hf.flats?.towers?.name ?? '', hf.flats?.number ?? '')),
  }));
  return { data: list, error };
}
