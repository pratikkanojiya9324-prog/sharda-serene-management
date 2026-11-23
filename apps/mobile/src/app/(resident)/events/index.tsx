import Ionicons from '@expo/vector-icons/Ionicons';
import { EVENT_SELECT } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { isUpcomingEvent } from '@/lib/community';
import { reportError } from '@/lib/errors';
import { formatIst } from '@/lib/ist';
import { useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type EventRow = {
  id: string;
  title: string;
  place: string | null;
  starts_at: string;
  ends_at: string | null;
  cancelled_at: string | null;
};

export default function EventsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const [events, setEvents] = useState<EventRow[]>([]);
  const [going, setGoing] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    if (!flatId) return;
    // RLS: events are readable by the society; a flat sees only its own RSVPs.
    const [e, r] = await Promise.all([
      supabase.from('events').select(EVENT_SELECT).order('starts_at', { ascending: false }).limit(100),
      supabase.from('event_rsvps').select('event_id, response').eq('flat_id', flatId),
    ]);
    const err = e.error ?? r.error;
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setEvents(e.data ?? []);
    setGoing(new Set((r.data ?? []).filter((x) => x.response === 'going').map((x) => x.event_id)));
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading: loading, hasFlat: !!flat });

  if (state === 'no_flat') {
    return (
      <Screen>
        <NoFlatState message={flatError} onRetry={reload} />
      </Screen>
    );
  }

  const now = new Date();
  const upcoming = events.filter((e) => isUpcomingEvent(e, now)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = events.filter((e) => !isUpcomingEvent(e, now));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)'));

  const row = (e: EventRow) => (
    <Card
      key={e.id}
      onPress={() => router.push({ pathname: '/(resident)/events/[id]', params: { id: e.id } })}
      accessibilityLabel={`${e.title}, ${formatIst(e.starts_at)}`}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <IconBadge icon="calendar" tone={e.cancelled_at ? 'neutral' : 'accent'} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]} numberOfLines={2}>
            {e.title}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {formatIst(e.starts_at)}
            {e.place ? ` · ${e.place}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        {e.cancelled_at ? <Pill label="Cancelled" tone="danger" icon="close-circle" /> : null}
        {going.has(e.id) && !e.cancelled_at ? <Pill label="Your flat is going" tone="success" icon="checkmark-circle" /> : null}
      </View>
    </Card>
  );

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline="Society" title="Events" onBack={back} />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : events.length ? (
        <>
          {upcoming.length ? (
            <>
              <SectionTitle title="Upcoming" />
              {upcoming.map(row)}
            </>
          ) : null}
          {past.length ? (
            <>
              <SectionTitle title="Past" />
              {past.map(row)}
            </>
          ) : null}
        </>
      ) : (
        <EmptyState icon="calendar-outline" title="No events yet" message="When the office plans an event, it will show up here." />
      )}
    </Screen>
  );
}
