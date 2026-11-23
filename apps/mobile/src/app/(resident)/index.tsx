import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { VisitRow } from '@/components/VisitRow';
import { getActorName } from '@/lib/actor';
import { reportError } from '@/lib/errors';
import { formatTime } from '@/lib/format';
import { usePushStatus } from '@/lib/pushStatus';
import { screenState } from '@/lib/screenState';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { VISIT_PURPOSE } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Screen, type IconName } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Visit = Database['public']['Tables']['visits']['Row'];

export default function ResidentHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const pushStatus = usePushStatus();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState<string | null>(null);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    setActor(await getActorName());
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('visits')
      .select('*')
      .eq('flat_id', flatId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setVisits(data ?? []);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading: loading, hasFlat: !!flat });

  // New / changed requests for this flat appear without pull-to-refresh.
  useEffect(() => {
    if (!flatId) return;
    const channel = supabase
      .channel(`resident-visits-${flatId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits', filter: `flat_id=eq.${flatId}` },
        (payload) => {
          const row = payload.new as Visit;
          if (!row?.id) return;
          setVisits((cur) => {
            const rest = cur.filter((v) => v.id !== row.id);
            return [row, ...rest].sort((a, b) => b.created_at.localeCompare(a.created_at));
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [flatId]);

  if (state === 'no_flat') {
    return (
      <Screen>
        <NoFlatState message={flatError} onRetry={reload} />
      </Screen>
    );
  }

  const pending = visits.filter((v) => v.status === 'pending' && !v.manual_outcome);
  const recent = visits.filter((v) => !pending.includes(v)).slice(0, 10);
  const open = (id: string) => router.push({ pathname: '/(resident)/request/[id]', params: { id } });

  return (
    <Screen scroll padded={false} edges={[]} refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        variant="hero"
        icon="home"
        overline={flat?.label ?? 'Society Gate'}
        title={actor ? `Hi, ${actor}` : 'Welcome home'}
        subtitle={
          pending.length
            ? `${pending.length} visitor${pending.length > 1 ? 's' : ''} waiting at the gate`
            : 'Visitors at the gate show up here'
        }
      />
      <View style={{ paddingHorizontal: space.xl, marginTop: -48, gap: space.md, paddingBottom: space.xxl }}>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: space.lg }}>
          <QuickAction icon="ticket" label="Guest pass" onPress={() => router.push('/(resident)/passes')} />
          <QuickAction icon="time" label="History" onPress={() => router.push('/(resident)/history')} />
          <QuickAction
            icon="construct"
            label="Complaint"
            onPress={() => router.push('/(resident)/complaints/new')}
          />
        </Card>

        <FlatSwitcher />

        {pushStatus && pushStatus !== 'ok' ? (
          <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
            <Banner text="Notifications are off — you may miss visitors" icon="notifications-off" />
            <Button title="Turn on notifications" variant="danger" icon="settings-outline" onPress={() => Linking.openSettings()} />
          </Card>
        ) : null}

        {error && state === 'ready' ? <Banner text={error} /> : null}

        {state === 'error' ? (
          <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
        ) : state === 'loading' ? (
          <Loading />
        ) : (
          <>
            <SectionTitle title="Waiting for you" count={pending.length} />
            {pending.length ? (
              pending.map((v) => <PendingCard key={v.id} visit={v} onPress={() => open(v.id)} />)
            ) : (
              <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconBadge icon="checkmark-done" tone="success" />
                <Text style={[type.body, { color: colors.textMuted, flex: 1 }]}>
                  No one is waiting. You will get a notification when someone arrives.
                </Text>
              </Card>
            )}

            <SectionTitle
              title="Recent visitors"
              right={
                <Pressable onPress={() => router.push('/(resident)/history')} hitSlop={8} accessibilityRole="button">
                  <Text style={[type.label, { color: colors.primary }]}>See all</Text>
                </Pressable>
              }
            />
            {recent.length ? (
              recent.map((v) => <VisitRow key={v.id} visit={v} onPress={() => open(v.id)} />)
            ) : (
              <EmptyState icon="people-outline" title="No visitors yet" message="Your flat's visitors will appear here." />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ alignItems: 'center', gap: space.sm, opacity: pressed ? 0.7 : 1, minWidth: 80 })}>
      <IconBadge icon={icon} size={52} />
      <Text style={[type.label, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function PendingCard({ visit, onPress }: { visit: Visit; onPress: () => void }) {
  const { colors } = useTheme();
  const purpose = VISIT_PURPOSE[visit.purpose];
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${visit.name}, ${purpose.label}, tap to respond`}
      style={{ borderColor: colors.accent, borderWidth: 1.5, backgroundColor: colors.accentSoft }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconBadge icon={purpose.icon} tone="accent" size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]}>{visit.name}</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {purpose.label} · {formatTime(visit.created_at)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={[type.label, { color: colors.warning }]}>Respond</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.warning} />
        </View>
      </View>
    </Card>
  );
}
