import { SOS_SELECT } from '@society-gate/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { guardErrorText } from './guardErrors';
import type { SosAlert } from './sos';
import { supabase } from './supabase';

type Fetch = () => Promise<{ rows: SosAlert[]; error: string | null }>;

/**
 * Keeps a list of alerts fresh. Realtime alone can miss a change (socket not
 * yet joined, app in background), so the list is also re-fetched when the
 * channel reports SUBSCRIBED, on any change and when the app returns to the
 * foreground. A failed fetch is surfaced as `error`, never swallowed.
 */
function useLiveSos(channelName: string, filter: string | null, fetchRows: Fetch) {
  const [rows, setRows] = useState<SosAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);

  const refetch = useCallback(async () => {
    const res = await fetchRows();
    if (!alive.current) return;
    setError(res.error);
    if (!res.error) {
      setRows(res.rows);
      setLoaded(true);
    }
  }, [fetchRows]);

  useEffect(() => {
    if (!filter) return;
    alive.current = true;
    const first = setTimeout(refetch, 0);
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts', filter }, () => refetch())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refetch();
      });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refetch();
    });
    return () => {
      alive.current = false;
      clearTimeout(first);
      appState.remove();
      supabase.removeChannel(channel);
    };
  }, [channelName, filter, refetch]);

  return { rows, error, loaded, refetch };
}

/** Open and acknowledged alerts of a society (guard / admin banner), newest first. */
export function useOpenSos(societyId: string | null) {
  const fetchRows = useCallback<Fetch>(async () => {
    if (!societyId) return { rows: [], error: null };
    const { data, error } = await supabase
      .from('sos_alerts')
      .select(SOS_SELECT)
      .eq('society_id', societyId)
      .in('status', ['open', 'acknowledged'])
      .order('created_at', { ascending: false });
    if (error) return { rows: [], error: guardErrorText(error.message) };
    return { rows: (data ?? []) as unknown as SosAlert[], error: null };
  }, [societyId]);
  const { rows, error, loaded, refetch } = useLiveSos(`sos-open-${societyId}`, societyId ? `society_id=eq.${societyId}` : null, fetchRows);
  return { alerts: rows, error, loaded, refetch };
}

/** The flat's most recent alert (resident SOS screen and Home strip). */
export function useFlatSos(flatId: string | null) {
  const fetchRows = useCallback<Fetch>(async () => {
    if (!flatId) return { rows: [], error: null };
    const { data, error } = await supabase
      .from('sos_alerts')
      .select(SOS_SELECT)
      .eq('flat_id', flatId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return { rows: [], error: guardErrorText(error.message) };
    return { rows: (data ?? []) as unknown as SosAlert[], error: null };
  }, [flatId]);
  const { rows, error, loaded, refetch } = useLiveSos(`sos-flat-${flatId}`, flatId ? `flat_id=eq.${flatId}` : null, fetchRows);
  return { alert: rows[0] ?? null, error, loaded, refetch };
}
