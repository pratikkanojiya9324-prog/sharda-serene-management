import { useCallback, useEffect, useRef, useState } from 'react';
import { PARCEL_SELECT, flatLabel } from '@society-gate/shared';
import { Card, EmptyState, ErrorBanner, PageHeader, Pill, Table, Tabs, td, th, type Tone } from '../components/ui';
import { dateTime } from '../lib/format';
import { SOCIETY_ID, supabase } from '../lib/supabase';

/** Newest parcels loaded per filter. */
const LIMIT = 500;

type Filter = 'at_gate' | 'collected' | 'returned' | 'all';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'at_gate', label: 'At gate' },
  { value: 'collected', label: 'Collected' },
  { value: 'returned', label: 'Returned' },
  { value: 'all', label: 'All' },
];
const STATUS: Record<string, { label: string; tone: Tone }> = {
  at_gate: { label: 'At gate', tone: 'amber' },
  collected: { label: 'Collected', tone: 'green' },
  returned: { label: 'Returned', tone: 'slate' },
};

export default function Parcels() {
  const [filter, setFilter] = useState<Filter>('at_gate');
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchParcels>>['data'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const { data, error: err } = await fetchParcels(filter);
    if (seq !== loadSeq.current) return; // filter changed meanwhile
    if (err) return setError(err.message);
    setError(null);
    setRows(data);
  }, [filter]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Parcels" subtitle="Parcels logged at the gate for flats." />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Tabs value={filter} onChange={setFilter} options={FILTERS} />
          <span className="ml-auto text-sm text-slate-500">{rows?.length ?? 0} shown</span>
        </div>
        {rows && rows.length === 0 ? (
          <EmptyState icon="clipboard" title="No parcels">Nothing matches this filter.</EmptyState>
        ) : (
          <Table
            head={
              <tr>
                <th className={th}>Flat</th>
                <th className={th}>Courier</th>
                <th className={th}>Logged</th>
                <th className={th}>Status</th>
                <th className={th}>Collected by / at</th>
              </tr>
            }
          >
            {rows?.map((p) => {
              const st = STATUS[p.status] ?? { label: p.status, tone: 'slate' as Tone };
              return (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className={`${td} font-semibold text-slate-900`}>{p.flat}</td>
                  <td className={td}>
                    {p.courier}
                    {p.note && <span className="block text-xs text-slate-400">{p.note}</span>}
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-500`}>{dateTime(p.created_at)}</td>
                  <td className={td}>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-500`}>
                    {p.status === 'at_gate' || !p.collected_at ? (
                      '—'
                    ) : (
                      <>
                        {p.status === 'collected' && p.collected_by_name && <span className="text-slate-700">{p.collected_by_name} · </span>}
                        {dateTime(p.collected_at)}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
        {rows?.length === LIMIT && <p className="px-5 py-3 text-xs text-slate-500">Showing the latest {LIMIT}. Use a status filter to see others.</p>}
      </Card>
    </>
  );
}

async function fetchParcels(filter: Filter) {
  let q = supabase.from('parcels').select(PARCEL_SELECT).eq('society_id', SOCIETY_ID).order('created_at', { ascending: false }).order('id').limit(LIMIT);
  if (filter !== 'all') q = q.eq('status', filter);
  const { data, error } = await q;
  const list = (data ?? []).map((p) => ({ ...p, flat: flatLabel(p.flats?.towers?.building ?? '', p.flats?.towers?.name ?? '', p.flats?.number ?? '') }));
  return { data: list, error };
}
