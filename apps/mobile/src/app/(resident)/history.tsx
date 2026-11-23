import type { Database } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { ErrorState, Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { VisitRow } from '@/components/VisitRow';
import { reportError } from '@/lib/errors';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Button, EmptyState, Header, Screen } from '@/theme/components';

type Visit = Database['public']['Tables']['visits']['Row'];
const PAGE = 30;

export default function HistoryScreen() {
  const router = useRouter();
  const { flat, loading: flatLoading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [visits, setVisits] = useState<Visit[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (offset: number) => {
      if (!flatId) return;
      const { data, error: err } = await supabase
        .from('visits')
        .select('*')
        .eq('flat_id', flatId)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE - 1);
      if (err) {
        setError(reportError(err));
        return false;
      }
      setError(null);
      const rows = data ?? [];
      setVisits((cur) => (offset === 0 ? rows : [...cur, ...rows]));
      setHasMore(rows.length === PAGE);
    },
    [flatId],
  );
  const firstPage = useCallback(() => fetchPage(0), [fetchPage]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(firstPage, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading, hasFlat: !!flat });

  async function more() {
    setLoadingMore(true);
    try {
      await fetchPage(visits.length);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Header title="Visitor history" subtitle={flat?.label} onBack={() => router.back()} />
      <FlatSwitcher />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {state === 'no_flat' ? (
        <NoFlatState message={flatError} onRetry={reload} />
      ) : state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : visits.length ? (
        <>
          {visits.map((v) => (
            <VisitRow
              key={v.id}
              visit={v}
              detailed
              onPress={() => router.push({ pathname: '/(resident)/request/[id]', params: { id: v.id } })}
            />
          ))}
          {hasMore ? <Button title="Load more" variant="secondary" icon="chevron-down" loading={loadingMore} onPress={more} /> : null}
        </>
      ) : (
        <EmptyState icon="time-outline" title="No visitors yet" message="Everyone who comes to your flat will be listed here." />
      )}
    </Screen>
  );
}
