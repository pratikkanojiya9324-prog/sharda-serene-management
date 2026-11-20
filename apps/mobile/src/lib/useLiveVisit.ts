import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { supabase } from './supabase';
import { mergeVisit, type Visit } from './visitMerge';

const POLL_MS = 4000;

type LoadError = { message: string; code?: string };

/**
 * One visit row kept fresh. Realtime alone can miss an update (socket not yet
 * joined, app in background), so the row is also re-fetched when the channel
 * reports SUBSCRIBED and when the app returns to the foreground, and, with
 * `pollWhilePending`, every 4 s while the visit is still pending.
 */
export function useLiveVisit(id: string, { pollWhilePending = false }: { pollWhilePending?: boolean } = {}) {
  const [visit, setVisit] = useState<Visit | null>(null);
  const [error, setError] = useState<LoadError | null>(null);
  const alive = useRef(true);

  const refetch = useCallback(async () => {
    const { data, error: err } = await supabase.from('visits').select('*').eq('id', id).single();
    if (!alive.current) return;
    if (err) setError({ message: err.message, code: err.code });
    else {
      setError(null);
      setVisit((cur) => mergeVisit(cur, data));
    }
  }, [id]);

  useEffect(() => {
    alive.current = true;
    refetch();
    const channel = supabase
      .channel(`visit-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'visits', filter: `id=eq.${id}` },
        (payload) => setVisit((cur) => mergeVisit(cur, payload.new as Visit)),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refetch();
      });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refetch();
    });
    return () => {
      alive.current = false;
      appState.remove();
      supabase.removeChannel(channel);
    };
  }, [id, refetch]);

  // Waiting for a resident: pending and the guard has not decided by hand.
  const isPending = visit?.status === 'pending' && !visit.manual_outcome;
  useEffect(() => {
    if (!pollWhilePending || !isPending) return;
    const t = setInterval(refetch, POLL_MS);
    return () => clearInterval(t);
  }, [pollWhilePending, isPending, refetch]);

  /** Apply a row returned by an RPC. */
  const applyVisit = useCallback((next: Visit) => setVisit((cur) => mergeVisit(cur, next)), []);

  return { visit, error, refetch, applyVisit };
}
