import { POLL_SELECT } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { PollResults } from '@/components/PollResults';
import { Loading, SectionTitle, useFocusLoad } from '@/components/resident';
import { useAdminSociety } from '@/lib/adminSociety';
import { reportError } from '@/lib/errors';
import {
  closesLabel,
  formatIst,
  parseOptions,
  parseResults,
  pollIsOpen,
  resultBars,
  turnoutText,
  type PollResults as Results,
} from '@/lib/polls';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

type PollDetail = {
  id: string;
  question: string;
  description: string | null;
  options: unknown;
  multi: boolean;
  max_choices: number;
  closes_at: string;
  closed_at: string | null;
};

export default function AdminPollScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { societyName } = useAdminSociety();
  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'remind' | 'close' | 'delete' | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('polls').select(POLL_SELECT).eq('id', id).maybeSingle();
    if (err) {
      setError(reportError(err));
      return false;
    }
    if (!data) {
      setMissing(true);
      setError(null);
      return;
    }
    const r = await supabase.rpc('poll_results', { p_poll_id: id });
    if (r.error) {
      setError(reportError(r.error));
      return false;
    }
    setError(null);
    setMissing(false);
    setPoll(data);
    setResults(parseResults(r.data));
  }, [id]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(admin)/polls'));

  async function run(kind: 'remind' | 'close' | 'delete') {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      if (kind === 'delete') {
        const { error: err } = await supabase.rpc('delete_poll', { p_poll_id: id });
        if (err) return setError(reportError(err));
        return back();
      }
      const { error: err } =
        kind === 'remind'
          ? await supabase.rpc('remind_poll', { p_poll_id: id })
          : await supabase.rpc('close_poll', { p_poll_id: id });
      if (err) {
        setError(reportError(err));
        // Already closed elsewhere: refresh so the buttons match reality.
        if (err.message === 'poll_closed') await load();
        return;
      }
      if (kind === 'remind') setNotice('Reminder sent to the flats that have not voted');
      else await load();
    } finally {
      setBusy(null);
      inFlight.current = false;
    }
  }

  const confirm = (title: string, message: string, label: string, kind: 'close' | 'delete') =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: label, style: 'destructive', onPress: () => run(kind) },
    ]);

  const now = new Date();
  const isOpen = poll ? pollIsOpen(poll, now) : false;

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline={societyName ?? 'Admin'} title="Poll" onBack={back} />
      {error && loaded ? <Banner text={error} /> : null}
      {notice ? <Banner text={notice} tone="success" /> : null}
      {!loaded ? (
        loadFailure || error ? <Banner text={(error ?? loadFailure) as string} /> : <Loading />
      ) : missing || !poll || !results ? (
        <EmptyState icon="stats-chart-outline" title="Poll not found" message="It may have been removed." />
      ) : (
        <>
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <Pill label={closesLabel(poll, now)} tone={isOpen ? 'info' : 'neutral'} icon={isOpen ? 'time-outline' : 'lock-closed'} />
              {poll.multi ? <Pill label={`Pick up to ${poll.max_choices}`} tone="neutral" icon="checkbox-outline" /> : null}
            </View>
            <Text style={[type.title, { color: colors.text }]} selectable>
              {poll.question}
            </Text>
            {poll.description ? (
              <Text style={[type.body, { color: colors.textMuted, lineHeight: 24 }]} selectable>
                {poll.description}
              </Text>
            ) : null}
            <Text style={[type.caption, { color: colors.textSubtle }]}>
              {isOpen ? 'Closes' : poll.closed_at ? 'Closed' : 'Closed at'}{' '}
              {formatIst(poll.closed_at ?? poll.closes_at)}
            </Text>
          </Card>

          <Card style={{ gap: space.lg }}>
            <PollResults
              bars={resultBars(parseOptions(poll.options), results.counts, [])}
              turnout={turnoutText(results.votedFlats, results.totalFlats)}
            />
          </Card>

          <SectionTitle title="Not voted yet" count={results.notVoted?.length || undefined} />
          {results.notVoted?.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {results.notVoted.map((label) => (
                <View
                  key={label}
                  style={{
                    paddingHorizontal: space.md,
                    paddingVertical: 6,
                    borderRadius: radius.pill,
                    backgroundColor: colors.surfaceMuted,
                  }}>
                  <Text style={[type.label, { color: colors.text }]}>{label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[type.body, { color: colors.textMuted }]}>Every flat has voted.</Text>
          )}

          <View style={{ gap: space.sm, marginTop: space.md }}>
            {isOpen ? (
              <>
                <Button
                  title="Send reminder"
                  icon="notifications-outline"
                  loading={busy === 'remind'}
                  disabled={!!busy && busy !== 'remind'}
                  onPress={() => run('remind')}
                />
                <Button
                  title="Close voting"
                  icon="lock-closed-outline"
                  variant="secondary"
                  loading={busy === 'close'}
                  disabled={!!busy && busy !== 'close'}
                  onPress={() => confirm('Close voting?', 'Residents will no longer be able to vote.', 'Close voting', 'close')}
                />
              </>
            ) : null}
            <Button
              title="Delete poll"
              icon="trash-outline"
              variant="danger"
              loading={busy === 'delete'}
              disabled={!!busy && busy !== 'delete'}
              onPress={() => confirm('Delete this poll?', 'The poll and all votes will be removed for good.', 'Delete', 'delete')}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
