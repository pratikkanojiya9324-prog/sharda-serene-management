import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { HelperAvatar } from '@/components/HelperAvatar';
import { ErrorState, Loading, SectionTitle, useFocusLoad } from '@/components/resident';
import { isSessionExpired, reportError } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { guardErrorText } from '@/lib/guardErrors';
import { helperFlatLabels, isInside, loadGuardHelpers, type GuardHelper } from '@/lib/guardHelperData';
import { helperAction, matchHelpers } from '@/lib/guardHelpers';
import { useGuardSociety } from '@/lib/guardSociety';
import { helperTypeLabel } from '@/lib/helpers';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Input, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

export default function DailyHelp() {
  const router = useRouter();
  const { societyId, error: societyError } = useGuardSociety();
  const [helpers, setHelpers] = useState<GuardHelper[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!societyId) return;
    const { data, error: err } = await loadGuardHelpers(societyId, false);
    if (err) {
      setError(isSessionExpired(err) ? reportError(err) : guardErrorText(err.message));
      return false;
    }
    setError(null);
    setHelpers(data);
  }, [societyId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!societyId);
  const state = screenState({ loaded, error: error ?? loadFailure });

  useEffect(() => {
    if (!societyId) return;
    const channel = supabase
      .channel(`helper-attendance-${societyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'helper_attendance', filter: `society_id=eq.${societyId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [societyId, load]);

  async function act(h: GuardHelper, action: 'check_in' | 'check_out') {
    if (inFlight.current) return;
    inFlight.current = true;
    setActionError(null);
    setBusyId(h.id);
    try {
      const { error: err } = await supabase.rpc(action === 'check_in' ? 'helper_check_in' : 'helper_check_out', {
        p_helper_id: h.id,
      });
      if (err) {
        setActionError(isSessionExpired(err) ? reportError(err) : guardErrorText(err.message));
        // e.g. already_inside / not_inside: show the real state.
        await load();
        return;
      }
      setQuery('');
      await load();
    } finally {
      setBusyId(null);
      inFlight.current = false;
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(guard)'));
  const q = query.trim();
  const matches = matchHelpers(helpers, q);
  const exact = /^\d{6}$/.test(q) && matches.length === 1 ? matches[0] : null;
  const rest = exact ? [] : matches;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline="Gate" title="Daily help" subtitle="Enter the 6-digit code or search by name" onBack={back} />
      {societyError ? <Banner text={societyError} /> : null}
      <Input
        label="Code or name"
        placeholder="e.g. 482915"
        value={query}
        onChangeText={setQuery}
        autoFocus
        autoCorrect={false}
        icon="search-outline"
      />
      {actionError ? <Banner text={actionError} /> : null}
      {error && state === 'ready' ? <Banner text={error} /> : null}

      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        societyError ? null : <Loading />
      ) : (
        <>
          {exact ? <HelperCard h={exact} big busy={busyId === exact.id} onAct={act} /> : null}
          {q && !matches.length ? (
            <EmptyState icon="search-outline" title="No match" message="Check the code, or search by name." />
          ) : null}
          {!helpers.length ? (
            <EmptyState icon="people-outline" title="No daily help yet" message="Residents add their help from the app." />
          ) : null}
          {rest.length ? <SectionTitle title={q ? 'Matches' : 'All daily help'} count={rest.length} /> : null}
          {rest.map((h) => (
            <HelperCard key={h.id} h={h} busy={busyId === h.id} onAct={act} />
          ))}
        </>
      )}
    </Screen>
  );
}

function HelperCard({
  h,
  big = false,
  busy,
  onAct,
}: {
  h: GuardHelper;
  big?: boolean;
  busy: boolean;
  onAct: (h: GuardHelper, a: 'check_in' | 'check_out') => void;
}) {
  const { colors } = useTheme();
  const inside = isInside(h);
  const action = helperAction(h, inside);
  const since = h.helper_attendance.find((a) => a.exit_at === null)?.entry_at;
  const status = inside
    ? { label: since ? `Inside since ${formatTime(since)}` : 'Inside', tone: 'success' as const, icon: 'checkmark-circle' as const }
    : !h.active
      ? { label: 'Blocked', tone: 'danger' as const, icon: 'ban' as const }
      : { label: 'Outside', tone: 'neutral' as const, icon: 'exit-outline' as const };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <HelperAvatar photoPath={h.photo_path} type={h.type} size={big ? 72 : 48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[big ? type.title : type.heading, { color: colors.text }]} numberOfLines={1}>
            {h.name}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {helperTypeLabel(h.type)} · {h.entry_code}
          </Text>
          <Text style={[type.caption, { color: colors.primary, fontWeight: '700' }]} numberOfLines={2}>
            {helperFlatLabels(h)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row' }}>
        <Pill label={status.label} tone={status.tone} icon={status.icon} />
      </View>
      {action === 'blocked' ? (
        <Button title="Blocked by office" icon="ban" variant="secondary" disabled onPress={() => {}} />
      ) : (
        <Button
          title={action === 'check_in' ? 'Check in' : 'Check out'}
          icon={action === 'check_in' ? 'log-in-outline' : 'log-out-outline'}
          variant={action === 'check_in' ? 'primary' : 'secondary'}
          loading={busy}
          onPress={() => onAct(h, action)}
        />
      )}
    </Card>
  );
}
