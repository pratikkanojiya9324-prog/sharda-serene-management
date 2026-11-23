import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { ADMIN_SOCIETIES_SELECT } from '@society-gate/shared';
import Layout from './components/Layout';
import { Button, Spinner } from './components/ui';
import { SOCIETY_ID, supabase } from './lib/supabase';
import Amenities from './pages/Amenities';
import Bills from './pages/Bills';
import Complaints from './pages/Complaints';
import Dashboard from './pages/Dashboard';
import DailyHelp from './pages/DailyHelp';
import Documents from './pages/Documents';
import EmergencyContacts from './pages/EmergencyContacts';
import Events from './pages/Events';
import Flats from './pages/Flats';
import Login from './pages/Login';
import Notices from './pages/Notices';
import Parcels from './pages/Parcels';
import Polls from './pages/Polls';
import SosLog from './pages/SosLog';
import Staff from './pages/Staff';
import VisitorLog from './pages/VisitorLog';

interface AdminContext {
  societyName: string;
  userName: string;
}

function FullPage({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center bg-slate-50 p-6">{children}</div>;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [ctx, setCtx] = useState<AdminContext | null>(null);
  const [notAdmin, setNotAdmin] = useState(false);
  // A failed load (network, server) is not "not an admin": show it with a retry.
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  // The signed-in user must be an admin of the configured society.
  const loadContext = useCallback(async (uid: string) => {
    const [m, p] = await Promise.all([
      supabase
        .from('memberships')
        .select(ADMIN_SOCIETIES_SELECT)
        .eq('profile_id', uid)
        .eq('society_id', SOCIETY_ID)
        .eq('role', 'admin')
        .maybeSingle(),
      supabase.from('profiles').select('name').eq('id', uid).maybeSingle(),
    ]);
    const err = m.error ?? p.error;
    if (err) return setLoadError(err.message);
    setLoadError(null);
    if (!m.data) {
      setNotAdmin(true);
      await supabase.auth.signOut();
      return;
    }
    setNotAdmin(false);
    setCtx({ societyName: m.data.societies?.name ?? 'Society', userName: p.data?.name ?? 'Admin' });
  }, []);

  useEffect(() => {
    if (!userId) {
      setCtx(null);
      setLoadError(null);
      return;
    }
    void loadContext(userId);
  }, [userId, loadContext]);

  if (!SOCIETY_ID) {
    return (
      <FullPage>
        <p className="text-sm text-slate-600">
          This admin site is not configured: set <code className="rounded bg-slate-100 px-1">VITE_SOCIETY_ID</code> in the
          environment and rebuild.
        </p>
      </FullPage>
    );
  }
  if (!ready) {
    return (
      <FullPage>
        <Spinner className="h-6 w-6 text-brand-700" />
      </FullPage>
    );
  }
  if (!session) return <Login notAdmin={notAdmin} />;
  if (loadError && userId) {
    return (
      <FullPage>
        <div className="space-y-4 text-center">
          <p className="text-sm text-red-700">Could not load your account: {loadError}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => void loadContext(userId)}>Try again</Button>
            <Button variant="secondary" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </FullPage>
    );
  }
  if (!ctx) {
    return (
      <FullPage>
        <Spinner className="h-6 w-6 text-brand-700" />
      </FullPage>
    );
  }

  return (
    <Layout societyName={ctx.societyName} userName={ctx.userName} onSignOut={() => void supabase.auth.signOut()}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/flats" element={<Flats />} />
        <Route path="/staff" element={<Staff userId={session.user.id} />} />
        <Route path="/notices" element={<Notices />} />
        <Route path="/polls" element={<Polls />} />
        <Route path="/complaints" element={<Complaints userId={session.user.id} userName={ctx.userName} />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/visits" element={<VisitorLog />} />
        <Route path="/daily-help" element={<DailyHelp />} />
        <Route path="/parcels" element={<Parcels />} />
        <Route path="/amenities" element={<Amenities />} />
        <Route path="/events" element={<Events />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/emergency-contacts" element={<EmergencyContacts />} />
        <Route path="/sos" element={<SosLog userName={ctx.userName} />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}
