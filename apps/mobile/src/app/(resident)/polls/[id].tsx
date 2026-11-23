import Ionicons from '@expo/vector-icons/Ionicons';
import { POLL_SELECT } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { PollResults } from '@/components/PollResults';
import { Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { reportError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { formatIst } from '@/lib/ist';
import {
  closesLabel,
  parseOptions,
  parseResults,
  pollIsOpen,
  resultBars,
  selectionError,
  turnoutText,
  type PollOption,
  type PollResults as Results,
} from '@/lib/polls';
import { useResidentFlat } from '@/lib/residentFlat';
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

export default function ResidentPollScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [results, setResults] = useState<Results | null>(null);
  const [missing, setMissing] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    if (!flatId) return;
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
    const r = await supabase.rpc('poll_results', { p_poll_id: id, p_flat_id: flatId });
    if (r.error) {
      setError(reportError(r.error));
      return false;
    }
    setError(null);
    setMissing(false);
    setPoll(data);
    setResults(parseResults(r.data));
  }, [id, flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)/polls'));

  const options: PollOption[] = poll ? parseOptions(poll.options) : [];
  const now = new Date();

  function toggle(optionId: string) {
    if (!poll) return;
    setVoteError(null);
    setSelected((cur) => {
      if (!poll.multi) return [optionId];
      return cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId];
    });
  }

  function confirmVote() {
    if (!poll || busy) return;
    const invalid = selectionError(poll, selected);
    if (invalid) return setVoteError(invalid);
    Alert.alert("Submit your flat's vote?", "It can't be changed later.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Vote', onPress: submit },
    ]);
  }

  async function submit() {
    if (!poll || !flatId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setVoteError(null);
    try {
      const actor = await getActorName();
      const { error: err } = await supabase.rpc('vote_poll', {
        p_poll_id: poll.id,
        p_flat_id: flatId,
        p_option_ids: selected,
        ...(actor ? { p_actor_name: actor } : {}),
      });
      if (err) {
        setVoteError(reportError(err));
        // Voted on another phone, or it closed meanwhile: show the current state.
        if (err.message === 'already_voted' || err.message === 'poll_closed') await load();
        return;
      }
      await load();
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  if (!flat && !loading) {
    return (
      <Screen>
        <NoFlatState message={flatError} onRetry={reload} />
      </Screen>
    );
  }

  const isOpen = poll ? pollIsOpen(poll, now) : false;
  const myVote = results?.myVote ?? null;
  const showResults = !!poll && !!results && (!!myVote || !isOpen);

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header title="Poll" onBack={back} />
      {error && loaded ? <Banner text={error} /> : null}
      {!loaded ? (
        loadFailure || error ? <Banner text={(error ?? loadFailure) as string} /> : <Loading />
      ) : missing || !poll ? (
        <EmptyState icon="stats-chart-outline" title="Poll not found" message="It may have been removed by the office." />
      ) : (
        <>
          <Card style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              <Pill label={closesLabel(poll, now)} tone={isOpen ? 'info' : 'neutral'} icon={isOpen ? 'time-outline' : 'lock-closed'} />
              {myVote ? <Pill label="Voted" tone="success" icon="checkmark-circle" /> : null}
            </View>
            <Text style={[type.title, { color: colors.text }]} selectable>
              {poll.question}
            </Text>
            {poll.description ? (
              <Text style={[type.body, { color: colors.textMuted, lineHeight: 24 }]} selectable>
                {poll.description}
              </Text>
            ) : null}
            {isOpen ? (
              <Text style={[type.caption, { color: colors.textSubtle }]}>Closes {formatIst(poll.closes_at)}</Text>
            ) : null}
          </Card>

          {showResults && results ? (
            <Card style={{ gap: space.lg }}>
              <PollResults
                bars={resultBars(options, results.counts, myVote?.optionIds ?? [])}
                turnout={turnoutText(results.votedFlats, results.totalFlats)}
              />
              {myVote ? (
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  Voted by {myVote.by?.trim() || 'your flat'}
                  {myVote.at ? ` · ${formatDateTime(myVote.at)}` : ''}
                </Text>
              ) : (
                <Text style={[type.caption, { color: colors.textMuted }]}>Your flat did not vote.</Text>
              )}
            </Card>
          ) : isOpen ? (
            <Card style={{ gap: space.md }}>
              {poll.multi ? (
                <Text style={[type.label, { color: colors.textMuted }]}>Pick up to {poll.max_choices}</Text>
              ) : null}
              {options.map((o) => (
                <OptionRow
                  key={o.id}
                  label={o.label}
                  multi={poll.multi}
                  checked={selected.includes(o.id)}
                  onPress={() => toggle(o.id)}
                />
              ))}
              {voteError ? <Banner text={voteError} /> : null}
              <Button title="Vote" icon="checkmark" loading={busy} disabled={!selected.length} onPress={confirmVote} />
              <Text style={[type.caption, { color: colors.textSubtle, textAlign: 'center' }]}>
                One vote per flat. Your choice stays secret.
              </Text>
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function OptionRow({
  label,
  multi,
  checked,
  onPress,
}: {
  label: string;
  multi: boolean;
  checked: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const icon = multi ? (checked ? 'checkbox' : 'square-outline') : checked ? 'radio-button-on' : 'radio-button-off';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: 52,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        borderWidth: checked ? 2 : 1,
        borderColor: checked ? colors.primary : colors.border,
        backgroundColor: checked ? colors.primarySoft : pressed ? colors.surfaceMuted : colors.surface,
      })}>
      <Ionicons name={icon} size={24} color={checked ? colors.primary : colors.textSubtle} />
      <Text style={[type.body, { color: colors.text, flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}
