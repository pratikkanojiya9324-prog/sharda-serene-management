import { useEffect, useState } from 'react';

import { supabase } from './supabase';

/**
 * The society the signed-in guard works in: their first `guard` membership.
 * v1 assumes a guard belongs to one society; if they have several, the first is used.
 */
export function useGuardSociety(): { societyId: string | null; error: string | null } {
  const [societyId, setSocietyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('memberships')
      .select('society_id')
      .eq('role', 'guard')
      .order('created_at')
      .limit(1)
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError(err.message);
        else if (!data?.[0]) setError('No guard membership found');
        else setSocietyId(data[0].society_id);
      });
    return () => {
      active = false;
    };
  }, []);

  return { societyId, error };
}
