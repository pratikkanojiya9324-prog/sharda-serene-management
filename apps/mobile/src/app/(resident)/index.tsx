import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database, HelperType } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { fetchEmergencyContacts } from '@/components/EmergencyContacts';
import { SosHoldButton, SosTypeSheet } from '@/components/SosHoldButton';
import { VisitRow } from '@/components/VisitRow';
import { getActorName } from '@/lib/actor';
import { reportError } from '@/lib/errors';
import { loadFlatHelpers } from '@/lib/flatHelpers';
import { formatTime } from '@/lib/format';
import { formatIst } from '@/lib/ist';
import { helperTypeIcon, helperTypeLabel, monthStartOf } from '@/lib/helpers';
import { isActiveSos, sosStatusText, sosTypeLabel } from '@/lib/sos';
import { useFlatSos } from '@/lib/useOpenSos';
import { usePushStatus } from '@/lib/pushStatus';
import { screenState } from '@/lib/screenState';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { VISIT_PURPOSE } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Screen, type IconName } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Visit = Database['public']['Tables']['visits']['Row'];
type InsideHelper = { id: string; since: string; name: string; type: HelperType };
type NextEvent = { id: string; title: string; starts_at: string };

export default function ResidentHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const pushStatus = usePushStatus();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actor, setActor] = useState<string | null>(null);
  const [parcelCount, setParcelCount] = useState(0);
  const [pollsWaiting, setPollsWaiting] = useState(0);
  const [inside, setInside] = useState<InsideHelper[]>([]);
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null);
  const flatId = flat?.id ?? null;
  const { alert: sosAlert, error: sosError, refetch: refetchSos } = useFlatSos(flatId);
  const [sosSheet, setSosSheet] = useState(false);

  const load = useCallback(async () => {
    setActor(await getActorName());
    // Warm the offline cache of emergency numbers for the SOS failure card.
    fetchEmergencyContacts().catch(() => {});
    if (!flatId) return;
    const [v, parcels, helpers, polls, votes, events] = await Promise.all([
      supabase.from('visits').select('*').eq('flat_id', flatId).order('created_at', { ascending: false }).limit(20),
      supabase.from('parcels').select('id', { count: 'exact', head: true }).eq('flat_id', flatId).eq('status', 'at_gate'),
      loadFlatHelpers(flatId, monthStartOf()),
      supabase.from('polls').select('id, closes_at, closed_at').is('closed_at', null).gt('closes_at', new Date().toISOString()),
      supabase.from('poll_votes').select('poll_id').eq('flat_id', flatId),
      supabase
        .from('events')
        .select('id, title, starts_at')
        .is('cancelled_at', null)
        .gt('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(1),
    ]);
    const err = v.error ?? parcels.error ?? polls.error ?? votes.error ?? events.error;
    if (err || helpers.error !== null) {
      setError(err ? reportError(err) : helpers.error);
      return false;
    }
    setError(null);
    setVisits(v.data ?? []);
    setParcelCount(parcels.count ?? 0);
    const votedIds = new Set((votes.data ?? []).map((r) => r.poll_id));
    setPollsWaiting((polls.data ?? []).filter((p) => !votedIds.has(p.id)).length);
    setNextEvent(events.data?.[0] ?? null);
    setInside(
      helpers.helpers
        .filter((h) => h.active)
        .flatMap((h) => {
          const open = h.helper_attendance.find((r) => r.exit_at === null);
          return open ? [{ id: h.id, since: open.entry_at, name: h.name, type: h.type }] : [];
        }),
    );
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
          <QuickAction icon="timer" label="Expecting" onPress={() => router.push('/(resident)/expecting')} />
          <QuickAction icon="people" label="Daily help" onPress={() => router.push('/(resident)/daily-help')} />
          <QuickAction icon="calendar" label="Book amenity" onPress={() => router.push('/(resident)/amenities')} />
        </Card>

        <FlatSwitcher />

        {isActiveSos(sosAlert) && sosAlert ? (
          <Card
            onPress={() => router.push('/(resident)/sos')}
            accessibilityLabel="SOS active, tap to view"
            style={{ backgroundColor: colors.danger, borderColor: colors.danger, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Ionicons name="alert-circle" size={28} color="#FFFFFF" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.heading, { color: '#FFFFFF' }]}>SOS active — tap to view</Text>
              <Text style={[type.caption, { color: '#FFFFFF' }]}>
                {sosTypeLabel(sosAlert.type)} · {sosStatusText(sosAlert)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', gap: space.md }}>
            <SosHoldButton onComplete={() => setSosSheet(true)} disabled={!flatId} />
            {sosError ? (
              <Pressable onPress={refetchSos} accessibilityRole="button">
                <Text style={[type.caption, { color: colors.danger, textAlign: 'center' }]}>
                  Couldn&apos;t check for an active SOS. {sosError} Tap to retry.
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.push('/(resident)/emergency')} accessibilityRole="button" hitSlop={8}>
              <Text style={[type.label, { color: colors.primary }]}>Emergency numbers</Text>
            </Pressable>
          </Card>
        )}
        <SosTypeSheet
          visible={sosSheet}
          onClose={() => setSosSheet(false)}
          onPick={(t) => {
            setSosSheet(false);
            router.push({ pathname: '/(resident)/sos', params: { type: t, at: String(Date.now()) } });
          }}
        />

        {pushStatus && pushStatus !== 'ok' ? (
          <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
            <Banner text="Notifications are off — you may miss visitors" icon="notifications-off" />
            <Button title="Turn on notifications" variant="danger" icon="settings-outline" onPress={() => Linking.openSettings()} />
          </Card>
        ) : null}

        {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}

        {state === 'error' ? (
          <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
        ) : state === 'loading' ? (
          <Loading />
        ) : (
          <>
            {parcelCount > 0 ? (
              <Card
                onPress={() => router.push('/(resident)/parcels')}
                accessibilityLabel={`${parcelCount} parcel${parcelCount > 1 ? 's' : ''} at the gate`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <IconBadge icon="cube" tone="accent" />
                <Text style={[type.heading, { color: colors.text, flex: 1 }]}>
                  {parcelCount} parcel{parcelCount > 1 ? 's' : ''} at the gate
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Card>
            ) : null}

            {pollsWaiting > 0 ? (
              <Card
                onPress={() => router.push('/(resident)/polls')}
                accessibilityLabel={`Polls waiting for your vote, ${pollsWaiting}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <IconBadge icon="stats-chart" tone="accent" />
                <Text style={[type.heading, { color: colors.text, flex: 1 }]}>
                  Polls waiting for your vote ({pollsWaiting})
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Card>
            ) : null}

            {nextEvent ? (
              <Card
                onPress={() => router.push({ pathname: '/(resident)/events/[id]', params: { id: nextEvent.id } })}
                accessibilityLabel={`Upcoming event, ${nextEvent.title}, ${formatIst(nextEvent.starts_at)}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                <IconBadge icon="calendar" tone="brand" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.overline, { color: colors.textSubtle }]}>UPCOMING EVENT</Text>
                  <Text style={[type.heading, { color: colors.text }]} numberOfLines={2}>
                    {nextEvent.title}
                  </Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>{formatIst(nextEvent.starts_at)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
              </Card>
            ) : null}

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

            {inside.length ? (
              <>
                <SectionTitle title="Daily help inside now" count={inside.length} />
                {inside.map((h) => (
                  <Card
                    key={h.id}
                    onPress={() => router.push({ pathname: '/(resident)/daily-help/[id]', params: { id: h.id } })}
                    accessibilityLabel={`${h.name}, inside since ${formatTime(h.since)}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <IconBadge icon={helperTypeIcon(h.type)} tone="success" />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[type.heading, { color: colors.text }]}>{h.name}</Text>
                      <Text style={[type.caption, { color: colors.textMuted }]}>
                        {helperTypeLabel(h.type)} · since {formatTime(h.since)}
                      </Text>
                    </View>
                  </Card>
                ))}
              </>
            ) : null}

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
      style={({ pressed }) => ({ alignItems: 'center', gap: space.sm, opacity: pressed ? 0.7 : 1, minWidth: 64 })}>
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
