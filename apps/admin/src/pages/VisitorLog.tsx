import { useCallback, useEffect, useState } from 'react';
import { ADMIN_VISIT_LOG_SELECT } from '@society-gate/shared';
import { Button, Card, EmptyState, ErrorBanner, Input, PageHeader, Pill, Select, Table, td, th } from '../components/ui';
import { useFlats } from '../lib/flats';
import { titleCase } from '../lib/format';
import { visitStyle } from '../lib/status';
import { SOCIETY_ID, supabase } from '../lib/supabase';

interface VisitRow {
  id: string;
  created_at: string;
  name: string;
  purpose: string;
  status: string;
  manual_outcome: string | null;
  flat_id: string;
  photo_path: string | null;
  entry_at: string | null;
  exit_at: string | null;
}

const PAGE = 200;

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

export default function VisitorLog() {
  const { flats, byId } = useFlats();
  const [date, setDate] = useState('');
  const [flatId, setFlatId] = useState('');
  const [rows, setRows] = useState<VisitRow[] | null>(null);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase.from('visits').select(ADMIN_VISIT_LOG_SELECT).eq('society_id', SOCIETY_ID).order('created_at', { ascending: false }).limit(PAGE);
    if (flatId) q = q.eq('flat_id', flatId);
    if (date) {
      // the admin's local calendar day
      const start = new Date(`${date}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      q = q.gte('created_at', start.toISOString()).lt('created_at', end.toISOString());
    }
    const { data, error: err } = await q;
    if (err) return setError(err.message);
    setError(null);
    const list = data ?? [];
    setRows(list);

    const paths = list.map((v) => v.photo_path).filter((p): p is string => !!p);
    if (paths.length === 0) return setPhotos({});
    const { data: signed } = await supabase.storage.from('visitor-photos').createSignedUrls(paths, 3600);
    const map: Record<string, string> = {};
    signed?.forEach((s) => {
      if (s.path && s.signedUrl) map[s.path] = s.signedUrl;
    });
    setPhotos(map);
  }, [flatId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader title="Visitor log" subtitle="Every visitor recorded at the gate." />
      {error && <ErrorBanner message={error} onRetry={() => void load()} />}
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" aria-label="Date" />
          <Select value={flatId} onChange={(e) => setFlatId(e.target.value)} className="w-44" aria-label="Flat">
            <option value="">All flats</option>
            {flats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
          <Button variant="secondary" icon="refresh" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        {rows && rows.length === 0 ? (
          <EmptyState icon="clipboard" title="No visits">Nothing recorded for these filters.</EmptyState>
        ) : (
          <Table
            head={
              <tr>
                <th className={th}>Visitor</th>
                <th className={th}>Flat</th>
                <th className={th}>Purpose</th>
                <th className={th}>Outcome</th>
                <th className={th}>Recorded</th>
                <th className={th}>In</th>
                <th className={th}>Out</th>
              </tr>
            }
          >
            {rows?.map((v) => {
              const st = visitStyle(v.status);
              return (
                <tr key={v.id} className="hover:bg-slate-50/60">
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      {v.photo_path && photos[v.photo_path] ? (
                        <img className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200" src={photos[v.photo_path]} alt="" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500">
                          {v.name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <span className="font-medium text-slate-900">{v.name}</span>
                    </div>
                  </td>
                  <td className={td}>{byId.get(v.flat_id)?.label ?? ''}</td>
                  <td className={td}>{titleCase(v.purpose)}</td>
                  <td className={td}>
                    <Pill tone={st.tone} icon={st.icon}>
                      {titleCase(v.status)}
                      {v.manual_outcome && ` · ${titleCase(v.manual_outcome)}`}
                    </Pill>
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-500`}>{new Date(v.created_at).toLocaleString()}</td>
                  <td className={td}>{time(v.entry_at)}</td>
                  <td className={td}>{time(v.exit_at)}</td>
                </tr>
              );
            })}
          </Table>
        )}
        {rows?.length === PAGE && <p className="px-5 py-3 text-xs text-slate-500">Showing the newest {PAGE}. Narrow by date or flat to see more.</p>}
      </Card>
    </>
  );
}
