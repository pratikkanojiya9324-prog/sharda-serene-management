import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Flats from './pages/Flats';
import People from './pages/People';
import VisitorLog from './pages/VisitorLog';

export interface AdminSociety {
  id: string;
  name: string;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [societies, setSocieties] = useState<AdminSociety[] | null>(null);
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [notAdmin, setNotAdmin] = useState(false);
  // true while Login verifies the OTP and claims invites, so memberships are read only afterwards
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  // Load the admin societies of the signed-in user (always filtered by profile_id:
  // RLS lets admins read every membership in their society).
  const loadSocieties = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('memberships')
      .select('society_id, societies(name)')
      .eq('profile_id', uid)
      .eq('role', 'admin');
    const list = error
      ? []
      : (data ?? []).map((m) => ({ id: m.society_id, name: m.societies?.name ?? 'Society' }));
    if (list.length === 0) {
      setNotAdmin(true);
      await supabase.auth.signOut();
      return;
    }
    setNotAdmin(false);
    setSocieties(list);
    setSocietyId((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0].id));
  }, []);

  useEffect(() => {
    if (!userId) {
      setSocieties(null);
      return;
    }
    if (claiming) return;
    void loadSocieties(userId);
  }, [userId, claiming, loadSocieties]);

  if (!ready) return <p>Loading…</p>;
  if (!session) return <Login notAdmin={notAdmin} setClaiming={setClaiming} />;
  if (!societies) return <p>Loading…</p>;

  const society = societies.find((s) => s.id === societyId) ?? societies[0];

  return (
    <>
      <header className="bar">
        <strong>Society Gate</strong>
        {societies.length > 1 ? (
          <select value={society.id} onChange={(e) => setSocietyId(e.target.value)} aria-label="Society">
            {societies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ) : (
          <span>{society.name}</span>
        )}
        <NavLink to="/flats">Flats</NavLink>
        <NavLink to="/people">People</NavLink>
        <NavLink to="/visits">Visitor log</NavLink>
        <span className="spacer" />
        <button onClick={() => supabase.auth.signOut()}>Sign out</button>
      </header>
      <main>
        {/* key remounts pages when the admin switches society */}
        <Routes key={society.id}>
          <Route path="/flats" element={<Flats society={society} />} />
          <Route path="/people" element={<People society={society} />} />
          <Route path="/visits" element={<VisitorLog society={society} />} />
          <Route path="*" element={<Navigate to="/flats" replace />} />
        </Routes>
      </main>
    </>
  );
}
