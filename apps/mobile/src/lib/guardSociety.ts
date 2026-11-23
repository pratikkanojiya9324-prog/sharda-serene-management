import { useCallback, useEffect, useState } from 'react';

import { guardErrorText } from './guardErrors';
import { supabase } from './supabase';

/**
 * The society the signed-in guard works in: their first `guard` membership.
 * v1 assumes a guard belongs to one society; if they have several, the first is used.
 * `reload` retries a failed lookup (the SOS banner offers it, so it never goes blank silently).
 */
export function useGuardSociety(): { societyId: string | null; error: string | null; reload: () => void } {
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    (async () => {
      setError(null);
      try {
        // RLS lets admins read every membership of their society, so filter to our own rows.
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        if (!active) return;
        if (!userId) return setError('Not signed in');
        const { data, error: err } = await supabase
          .from('memberships')
          .select('society_id')
          .eq('profile_id', userId)
          .eq('role', 'guard')
          .order('created_at')
          .limit(1);
        if (!active) return;
        if (err) setError(guardErrorText(err.message));
        else if (!data?.[0]) setError('This number is not set up as a guard. Ask your admin.');
        else setSocietyId(data[0].society_id);
      } catch (e) {
        if (active) setError(guardErrorText((e as Error | null)?.message));
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  return { societyId, error, reload };
}
