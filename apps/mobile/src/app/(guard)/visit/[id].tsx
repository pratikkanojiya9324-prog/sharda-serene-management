import Ionicons from '@expo/vector-icons/Ionicons';
import { FLAT_DIRECTORY_SELECT, shouldShowCallButton, type VisitStatus } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { CallResident } from '@/components/CallResident';
import { IconBadge, InfoRow, Loading } from '@/components/resident';
import { actorLabel } from '@/lib/attribution';
import { flatLabels } from '@/lib/flatDirectory';
import { formatTime } from '@/lib/format';
import { guardErrorText } from '@/lib/guardErrors';
import { VISIT_PURPOSE } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { useLiveVisit } from '@/lib/useLiveVisit';
import { useVisitPhoto } from '@/lib/useVisitPhoto';
import type { Visit } from '@/lib/visitMerge';
import { Banner, Button, Card, Header, Screen, type IconName } from '@/theme/components';
import { radius, space, toneColors, type, useTheme, type Tone } from '@/theme/tokens';

const BANNER: Record<VisitStatus, { text: string; tone: Tone; icon: IconName }> = {
  pending: { text: 'Waiting', tone: 'accent', icon: 'hourglass' },
  approved: { text: 'Approved', tone: 'success', icon: 'checkmark-circle' },
  denied: { text: 'Denied', tone: 'danger', icon: 'close-circle' },
  leave_at_gate: { text: 'Leave at gate', tone: 'info', icon: 'cube' },
  expired: { text: 'No response', tone: 'neutral', icon: 'time' },
};

export default function VisitScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id, photo } = useLocalSearchParams<{ id: string; photo?: string }>();
  // Realtime + re-fetch on (re)subscribe / foreground + 4 s poll while waiting.
  const { visit, error: loadError, applyVisit } = useLiveVisit(id, { pollWhilePending: true });
  const [noAppUsers, setNoAppUsers] = useState(false);
  const [flat, setFlat] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const photoUrl = useVisitPhoto(visit?.photo_path);

  const flatId = visit?.flat_id ?? null;
  useEffect(() => {
    if (!flatId) return;
    let active = true;
    supabase.rpc('visit_has_app_users', { p_flat_id: flatId }).then((r) => {
      if (active && !r.error) setNoAppUsers(!r.data);
    });
    supabase
      .from('flats')
      .select(FLAT_DIRECTORY_SELECT)
      .eq('id', flatId)
      .then((r) => {
        if (active && r.data) setFlat(flatLabels(r.data).get(flatId) ?? null);
      });
    return () => {
      active = false;
    };
  }, [flatId]);

  // Re-evaluate the "call resident" button every second.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function run(action: () => PromiseLike<{ data: Visit | null; error: { message: string } | null }>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setBusy(true);
    try {
      const { data, error: err } = await action();
      if (err) setError(guardErrorText(err.message));
      else if (data) applyVisit(data);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(guard)'));

  if (!visit) {
    return (
      <Screen>
        <Header title="Visit" onBack={back} />
        {loadError ? (
          <Banner text={loadError.code === 'PGRST116' ? 'This visit was not found.' : guardErrorText(loadError.message)} />
        ) : (
          <Loading />
        )}
      </Screen>
    );
  }

  const banner = BANNER[visit.status];
  const tone = toneColors(colors, banner.tone);
  const purpose = VISIT_PURPOSE[visit.purpose];
  const showCall = shouldShowCallButton(
    { status: visit.status, created_at: visit.created_at, no_app_users: noAppUsers },
    now,
  );
  const canDecide = (visit.status === 'pending' || visit.status === 'expired') && !visit.manual_outcome;
  const mayEnter = visit.status === 'approved' || visit.manual_outcome === 'allowed';
  const answered = visit.status === 'approved' || visit.status === 'denied' || visit.status === 'leave_at_gate';

  return (
    <Screen scroll>
      <Header overline={flat ?? 'Visit'} title={visit.name} subtitle={`${purpose.label} · ${formatTime(visit.created_at)}`} onBack={back} />

      <View
        style={{
          alignItems: 'center',
          gap: space.sm,
          paddingVertical: space.xl,
          borderRadius: radius.lg,
          backgroundColor: tone.bg,
          borderWidth: 2,
          borderColor: tone.fg,
        }}
        accessibilityRole="summary"
        accessibilityLabel={`Status: ${banner.text}`}>
        <Ionicons name={banner.icon} size={44} color={tone.fg} />
        <Text style={{ color: tone.fg, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 }}>{banner.text}</Text>
        {answered && visit.responded_by_name ? (
          <Text style={[type.label, { color: tone.fg }]}>by {actorLabel(visit.responded_by_name, flat)}</Text>
        ) : null}
        {visit.manual_outcome ? (
          <Text style={[type.label, { color: colors.textMuted }]}>
            Guard: {visit.manual_outcome === 'allowed' ? 'let in' : 'sent back'}
          </Text>
        ) : null}
      </View>

      {photo === 'failed' && !visit.photo_path ? (
        <Banner text="Photo not saved. The resident was still notified." tone="warning" />
      ) : null}

      <CallResident flatId={visit.flat_id} visible={showCall} noAppUsers={noAppUsers} />

      {canDecide ? (
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Button
            title="Allow"
            icon="checkmark"
            disabled={busy}
            style={{ flex: 1 }}
            onPress={() =>
              run(() => supabase.rpc('record_manual_outcome', { p_visit_id: visit.id, p_outcome: 'allowed' }))
            }
          />
          <Button
            title="Send back"
            icon="arrow-undo"
            variant="danger"
            disabled={busy}
            style={{ flex: 1 }}
            onPress={() =>
              run(() => supabase.rpc('record_manual_outcome', { p_visit_id: visit.id, p_outcome: 'sent_back' }))
            }
          />
        </View>
      ) : null}

      {mayEnter && !visit.entry_at ? (
        <Button
          title="Mark entry"
          icon="log-in-outline"
          loading={busy}
          onPress={() => run(() => supabase.rpc('mark_entry', { p_visit_id: visit.id }))}
        />
      ) : null}
      {visit.entry_at && !visit.exit_at ? (
        <Button
          title="Mark exit"
          icon="log-out-outline"
          variant="secondary"
          loading={busy}
          onPress={() => run(() => supabase.rpc('mark_exit', { p_visit_id: visit.id }))}
        />
      ) : null}

      {error ? <Banner text={error} /> : null}

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconBadge icon={purpose.icon} />
          <View style={{ flex: 1 }}>
            <Text style={[type.heading, { color: colors.text }]}>{visit.name}</Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>{visit.pass_id ? 'Guest pass' : purpose.label}</Text>
          </View>
        </View>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{ width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
            resizeMode="cover"
            accessibilityLabel="Visitor photo"
          />
        ) : null}
        <View style={{ gap: space.sm }}>
          <InfoRow icon="home-outline" label="Flat" value={flat ?? '—'} />
          <InfoRow icon="time-outline" label="Arrived" value={formatTime(visit.created_at)} />
          {visit.entry_at ? <InfoRow icon="log-in-outline" label="Entered" value={formatTime(visit.entry_at)} /> : null}
          {visit.exit_at ? <InfoRow icon="log-out-outline" label="Exited" value={formatTime(visit.exit_at)} /> : null}
        </View>
      </Card>
    </Screen>
  );
}
