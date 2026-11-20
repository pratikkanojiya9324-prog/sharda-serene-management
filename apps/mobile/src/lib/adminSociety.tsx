import { ADMIN_SOCIETIES_SELECT } from '@society-gate/shared';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { friendlyError } from './errors';
import { supabase } from './supabase';

type Ctx = {
  societyId: string | null;
  societyName: string | null;
  /** The signed-in admin's user id and display name (sent with their comments). */
  userId: string | null;
  userName: string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const AdminSocietyContext = createContext<Ctx>({
  societyId: null,
  societyName: null,
  userId: null,
  userName: null,
  loading: true,
  error: null,
  reload: () => {},
});

/**
 * The society the signed-in admin manages: their own `admin` membership
 * (always filtered by profile_id — RLS shows admins every membership of the
 * society). Ordered by society_id like the server's admin_society(), so the
 * notice attachment folder matches the society create_notice posts to.
 */
export function AdminSocietyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<Ctx, 'reload'>>({
    societyId: null,
    societyName: null,
    userId: null,
    userName: null,
    loading: true,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id ?? null;
      if (!active) return;
      if (!uid) return setState((s) => ({ ...s, loading: false, error: 'Not signed in' }));
      const [m, p] = await Promise.all([
        supabase
          .from('memberships')
          .select(ADMIN_SOCIETIES_SELECT)
          .eq('profile_id', uid)
          .eq('role', 'admin')
          .order('society_id')
          .limit(1),
        supabase.from('profiles').select('name').eq('id', uid).maybeSingle(),
      ]);
      if (!active) return;
      const err = m.error ?? p.error;
      const row = m.data?.[0];
      setState({
        societyId: row?.society_id ?? null,
        societyName: row?.societies?.name ?? null,
        userId: uid,
        userName: p.data?.name?.trim() || null,
        loading: false,
        error: err ? friendlyError(err.message) : row ? null : 'This account is not an admin of any society',
      });
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  return <AdminSocietyContext.Provider value={{ ...state, reload }}>{children}</AdminSocietyContext.Provider>;
}

export function useAdminSociety(): Ctx {
  return useContext(AdminSocietyContext);
}
