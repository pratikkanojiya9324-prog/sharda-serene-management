import { useCallback, useEffect, useState } from 'react';
import type { AdminSociety } from '../App';
import { parseFlatsCsv } from '../lib/csv';
import { supabase } from '../lib/supabase';

interface Tower {
  id: string;
  name: string;
}
interface Flat {
  id: string;
  tower_id: string;
  number: string;
}

export default function Flats({ society }: { society: AdminSociety }) {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newTower, setNewTower] = useState('');
  const [flatTower, setFlatTower] = useState('');
  const [flatNumber, setFlatNumber] = useState('');
  const [csv, setCsv] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const [t, f] = await Promise.all([
      supabase.from('towers').select('id, name').eq('society_id', society.id).order('name'),
      supabase.from('flats').select('id, tower_id, number').eq('society_id', society.id).order('number'),
    ]);
    if (t.error || f.error) setError((t.error ?? f.error)!.message);
    setTowers(t.data ?? []);
    setFlats(f.data ?? []);
  }, [society.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addTower(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = newTower.trim();
    if (!name) return;
    const { error: err } = await supabase.from('towers').insert({ society_id: society.id, name });
    if (err) setError(err.code === '23505' ? 'That tower already exists' : err.message);
    else setNewTower('');
    await load();
  }

  async function saveRename() {
    if (!renaming) return;
    setError(null);
    const name = renaming.name.trim();
    if (!name) return;
    const { error: err } = await supabase.from('towers').update({ name }).eq('id', renaming.id);
    if (err) setError(err.code === '23505' ? 'That tower already exists' : err.message);
    else setRenaming(null);
    await load();
  }

  async function addFlat(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const number = flatNumber.trim();
    if (!flatTower || !number) return;
    const { error: err } = await supabase
      .from('flats')
      .insert({ society_id: society.id, tower_id: flatTower, number });
    if (err) setError(err.code === '23505' ? 'That flat already exists' : err.message);
    else setFlatNumber('');
    await load();
  }

  async function bulkAdd() {
    setError(null);
    setSummary(null);
    let rows;
    try {
      rows = parseFlatsCsv(csv);
    } catch (e) {
      const m = /^bad_row:(\d+)$/.exec((e as Error).message);
      setError(m ? `Line ${m[1]} should be: tower,flat` : (e as Error).message);
      return;
    }
    if (rows.length === 0) {
      setError('Paste at least one tower,flat line');
      return;
    }

    // 1. towers: create the missing ones (matched by name within this society)
    const { data: existingTowers, error: tErr } = await supabase
      .from('towers')
      .select('id, name')
      .eq('society_id', society.id);
    if (tErr) return setError(tErr.message);
    const towerId = new Map((existingTowers ?? []).map((t) => [t.name, t.id]));
    const missing = [...new Set(rows.map((r) => r.tower))].filter((n) => !towerId.has(n));
    if (missing.length > 0) {
      const { data: created, error: cErr } = await supabase
        .from('towers')
        .insert(missing.map((name) => ({ society_id: society.id, name })))
        .select('id, name');
      if (cErr) return setError(cErr.message);
      created.forEach((t) => towerId.set(t.name, t.id));
    }

    // 2. flats: skip ones that already exist (or repeat within the paste)
    const { data: existingFlats, error: fErr } = await supabase
      .from('flats')
      .select('tower_id, number')
      .eq('society_id', society.id);
    if (fErr) return setError(fErr.message);
    const seen = new Set((existingFlats ?? []).map((f) => `${f.tower_id}|${f.number}`));
    const toInsert: { society_id: string; tower_id: string; number: string }[] = [];
    let skipped = 0;
    for (const r of rows) {
      const tid = towerId.get(r.tower)!;
      const key = `${tid}|${r.flat}`;
      if (seen.has(key)) {
        skipped++;
        continue;
      }
      seen.add(key);
      toInsert.push({ society_id: society.id, tower_id: tid, number: r.flat });
    }
    if (toInsert.length > 0) {
      const { error: iErr } = await supabase.from('flats').insert(toInsert);
      if (iErr) return setError(iErr.message);
    }
    setSummary(`Added ${toInsert.length} flats, skipped ${skipped} existing`);
    setCsv('');
    await load();
  }

  return (
    <>
      <h2>Towers and flats</h2>
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h3>Add tower</h3>
        <form className="row" onSubmit={addTower}>
          <input placeholder="Tower name" value={newTower} onChange={(e) => setNewTower(e.target.value)} />
          <button>Add tower</button>
        </form>
        <h3>Add flat</h3>
        <form className="row" onSubmit={addFlat}>
          <select value={flatTower} onChange={(e) => setFlatTower(e.target.value)} aria-label="Tower">
            <option value="">Tower…</option>
            {towers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <input placeholder="Flat number" value={flatNumber} onChange={(e) => setFlatNumber(e.target.value)} />
          <button>Add flat</button>
        </form>
      </div>

      <div className="card">
        <h3>Bulk add flats</h3>
        <p className="muted">One flat per line as tower,flat (for example A,101). A header line is ignored.</p>
        <textarea rows={6} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={'tower,flat\nA,101\nA,102'} />
        <div className="row">
          <button onClick={bulkAdd}>Add flats</button>
          {summary && <span className="ok">{summary}</span>}
        </div>
      </div>

      {towers.length === 0 && <p className="muted">No towers yet.</p>}
      {towers.map((t) => (
        <div className="card" key={t.id}>
          {renaming?.id === t.id ? (
            <div className="row">
              <input value={renaming.name} onChange={(e) => setRenaming({ id: t.id, name: e.target.value })} />
              <button onClick={saveRename}>Save</button>
              <button onClick={() => setRenaming(null)}>Cancel</button>
            </div>
          ) : (
            <div className="row">
              <strong>Tower {t.name}</strong>
              <button onClick={() => setRenaming({ id: t.id, name: t.name })}>Rename</button>
            </div>
          )}
          <p>
            {flats
              .filter((f) => f.tower_id === t.id)
              .map((f) => f.number)
              .join(', ') || <span className="muted">No flats</span>}
          </p>
        </div>
      ))}
    </>
  );
}
