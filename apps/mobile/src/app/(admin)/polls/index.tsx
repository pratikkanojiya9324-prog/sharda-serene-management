import Ionicons from '@expo/vector-icons/Ionicons';
import { POLL_SELECT } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, SectionTitle, useFocusLoad } from '@/components/resident';
import { useAdminSociety } from '@/lib/adminSociety';
import { reportError } from '@/lib/errors';
import { closesLabel, parseResults, pollIsOpen, turnoutText } from '@/lib/polls';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

type PollRow = {
  id: string;
  question: string;
  closes_at: string;
  closed_at: string | null;
  created_at: string;
};

export default function AdminPollsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { societyId, societyName } = useAdminSociety();
  const [polls, setPolls] = useState<PollRow[]>([]);
  const [turnout, setTurnout] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!societyId) return;
    const { data, error: err } = await supabase
      .from('polls')
      .select(POLL_SELECT)
      .eq('society_id', societyId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (err) {
      setError(reportError(err));
      return false;
    }
    const rows = data ?? [];
    // Turnout comes from poll_results (the votes table itself is not readable by the office).
    const res = await Promise.all(rows.map((p) => supabase.rpc('poll_results', { p_poll_id: p.id })));
    const failed = res.find((r) => r.error);
    if (failed?.error) {
      setError(reportError(failed.error));
      return false;
    }
    const next: Record<string, string> = {};
    rows.forEach((p, i) => {
      const r = parseResults(res[i].data);
      if (r) next[p.id] = turnoutText(r.votedFlats, r.totalFlats);
    });
    setError(null);
    setPolls(rows);
    setTurnout(next);
  }, [societyId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!societyId);
  const state = screenState({ loaded, error: error ?? loadFailure });

  const now = new Date();
  const open = polls.filter((p) => pollIsOpen(p, now));
  const closed = polls.filter((p) => !pollIsOpen(p, now));
  const go = (id: string) => router.push({ pathname: '/(admin)/polls/[id]', params: { id } });

  const row = (p: PollRow) => {
    const isOpen = pollIsOpen(p, now);
    return (
      <Card key={p.id} onPress={() => go(p.id)} accessibilityLabel={`${p.question}, ${closesLabel(p, now)}`}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <IconBadge icon="stats-chart" tone={isOpen ? 'brand' : 'neutral'} />
          <Text style={[type.heading, { color: colors.text, flex: 1 }]} numberOfLines={3}>
            {p.question}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Pill label={closesLabel(p, now)} tone={isOpen ? 'info' : 'neutral'} icon={isOpen ? 'time-outline' : 'lock-closed'} />
          {turnout[p.id] ? <Pill label={turnout[p.id]} tone="success" icon="people" /> : null}
        </View>
      </Card>
    );
  };

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        overline={societyName ?? 'Admin'}
        title="Polls"
        subtitle="One vote per flat, kept secret"
        right={
          <Pressable
            onPress={() => router.push('/(admin)/polls/new')}
            accessibilityRole="button"
            accessibilityLabel="New poll"
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="add" size={26} color={colors.onPrimary} />
          </Pressable>
        }
      />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : polls.length ? (
        <>
          {open.length ? (
            <>
              <SectionTitle title="Open" />
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
        <EmptyState icon="stats-chart-outline" title="No polls yet" message="Start a poll to hear from every flat." />
      )}
    </Screen>
  );
}
