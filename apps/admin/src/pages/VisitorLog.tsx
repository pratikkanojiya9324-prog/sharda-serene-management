import { useCallback, useEffect, useState } from 'react';
import { ADMIN_FLATS_SELECT, ADMIN_VISIT_LOG_SELECT } from '@society-gate/shared';
import type { AdminSociety } from '../App';
import { supabase } from '../lib/supabase';

interface FlatOption {
  id: string;
  label: string;
}
interface VisitRow {
  id: string;
  created_at: string;
  name: string;
  purpose: string;
  status: string;
  manual_outcome: string | null;
  flat_id: string;
  photo_path: string | null;
}

const PAGE = 200;

export default function VisitorLog({ society }: { society: AdminSociety }) {
  const [flats, setFlats] = useState<FlatOption[]>([]);
  const [date, setDate] = useState('');
  const [flatId, setFlatId] = useState('');
  const [rows, setRows] = useState<VisitRow[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('flats')
      .select(ADMIN_FLATS_SELECT)
      .eq('society_id', society.id)
      .then(({ data }) =>
        setFlats(
          (data ?? [])
            .map((x) => ({ id: x.id, label: `${x.towers?.name ?? '?'}-${x.number}` }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
        ),
      );
  }, [society.id]);

  const load = useCallback(async () => {
    setError(null);
    let q = supabase
      .from('visits')
      .select(ADMIN_VISIT_LOG_SELECT)
      .eq('society_id', society.id)
      .order('created_at', { ascending: false })
      .limit(PAGE);
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
  }, [society.id, flatId, date]);

  useEffect(() => {
    void load();
  }, [load]);

  const label = new Map(flats.map((f) => [f.id, f.label]));

  return (
    <>
      <h2>Visitor log</h2>
      <div className="row">
        <label>
          Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <select value={flatId} onChange={(e) => setFlatId(e.target.value)} aria-label="Flat">
          <option value="">All flats</option>
          {flats.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <button onClick={() => void load()}>Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Photo</th>
              <th>Time</th>
              <th>Visitor</th>
              <th>Flat</th>
              <th>Purpose</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => (
              <tr key={v.id}>
                <td>{v.photo_path && photos[v.photo_path] && <img className="thumb" src={photos[v.photo_path]} alt="" />}</td>
                <td>{new Date(v.created_at).toLocaleString()}</td>
                <td>{v.name}</td>
                <td>{label.get(v.flat_id) ?? ''}</td>
                <td>{v.purpose}</td>
                <td>{v.manual_outcome ? `${v.status} (${v.manual_outcome})` : v.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No visits.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rows.length === PAGE && <p className="muted">Showing the newest {PAGE}. Narrow by date or flat to see more.</p>}
      </div>
    </>
  );
}
