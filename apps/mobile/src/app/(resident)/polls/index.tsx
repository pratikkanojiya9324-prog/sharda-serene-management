import Ionicons from '@expo/vector-icons/Ionicons';
import { POLL_SELECT } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { reportError } from '@/lib/errors';
import { closesLabel, pollIsOpen } from '@/lib/polls';
import { useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type PollRow = {
  id: string;
  question: string;
  closes_at: string;
  closed_at: string | null;
  created_at: string;
};

export default function ResidentPollsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    if (!flatId) return;
    // RLS: polls are readable by the society, and a flat sees only its own vote rows.
    const [p, v] = await Promise.all([
      supabase.from('polls').select(POLL_SELECT).order('created_at', { ascending: false }).limit(100),
      supabase.from('poll_votes').select('poll_id').eq('flat_id', flatId),
    ]);
    const err = p.error ?? v.error;
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setPolls(p.data ?? []);
    setVoted(new Set((v.data ?? []).map((r) => r.poll_id)));
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
  const open = polls.filter((p) => pollIsOpen(p, now));
  const closed = polls.filter((p) => !pollIsOpen(p, now));
  const go = (id: string) => router.push({ pathname: '/(resident)/polls/[id]', params: { id } });
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)'));

  const row = (p: PollRow) => {
    const isOpen = pollIsOpen(p, now);
    const hasVoted = voted.has(p.id);
    return (
      <Card
        key={p.id}
        onPress={() => go(p.id)}
        accessibilityLabel={`${p.question}, ${closesLabel(p, now)}, ${hasVoted ? 'voted' : 'not voted'}`}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <IconBadge icon="stats-chart" tone={isOpen ? (hasVoted ? 'success' : 'accent') : 'neutral'} />
          <Text style={[type.heading, { color: colors.text, flex: 1 }]} numberOfLines={3}>
            {p.question}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Pill label={closesLabel(p, now)} tone={isOpen ? 'info' : 'neutral'} icon={isOpen ? 'time-outline' : 'lock-closed'} />
          <Pill
            label={hasVoted ? 'Voted' : 'Not voted'}
            tone={hasVoted ? 'success' : isOpen ? 'accent' : 'neutral'}
            icon={hasVoted ? 'checkmark-circle' : 'ellipse-outline'}
          />
        </View>
      </Card>
    );
  };

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline="Society" title="Polls" subtitle="One vote per flat, kept secret" onBack={back} />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : polls.length ? (
        <>
          {open.length ? (
            <>
              <SectionTitle title="Open" count={open.filter((p) => !voted.has(p.id)).length || undefined} />
              {open.map(row)}
            </>
          ) : null}
          {closed.length ? (
            <>
              <SectionTitle title="Closed" />
              {closed.map(row)}
            </>
          ) : null}
        </>
      ) : (
        <EmptyState icon="stats-chart-outline" title="No polls yet" message="When the office starts a poll, it will show up here." />
      )}
    </Screen>
  );
}
