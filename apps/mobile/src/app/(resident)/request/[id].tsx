import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { IconBadge, InfoRow, Loading } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { friendlyError } from '@/lib/errors';
import { formatDateTime, formatTime } from '@/lib/format';
import { requestResultText } from '@/lib/requestResult';
import { useResidentFlat } from '@/lib/residentFlat';
import { VISIT_PURPOSE, visitPill } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { useLiveVisit } from '@/lib/useLiveVisit';
import { useVisitPhoto } from '@/lib/useVisitPhoto';
import { Banner, Button, Card, Header, Pill, Screen } from '@/theme/components';
import { radius, space, toneColors, type, useTheme } from '@/theme/tokens';

type Response = 'approved' | 'denied' | 'leave_at_gate';

export default function RequestScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flat } = useResidentFlat();
  // Realtime + re-fetch on (re)subscribe and when the app returns to the foreground.
  const { visit, error: loadError, refetch, applyVisit } = useLiveVisit(id);
  const [busy, setBusy] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoUrl = useVisitPhoto(visit?.photo_path);
  // Synchronous guard: a fast double tap fires twice before `busy` re-renders.
  const inFlight = useRef(false);

  async function respond(response: Response) {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setBusy(response);
    try {
      const { data, error: err } = await supabase.rpc('respond_to_visit', {
        p_visit_id: id,
        p_response: response,
        p_actor_name: (await getActorName()) ?? undefined,
      });
      if (err) {
        setError(friendlyError(err.message));
        // Refresh so the screen shows the answer that won.
        await refetch();
      } else if (data) applyVisit(data);
    } finally {
      setBusy(null);
      inFlight.current = false;
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)'));

  if (!visit) {
    const text = loadError ? friendlyError(loadError.code === 'PGRST116' ? 'not_authorized' : loadError.message) : null;
    return (
      <Screen>
        <Header title="Visitor" onBack={back} />
        {text ? <Banner text={text} /> : <Loading />}
      </Screen>
    );
  }

  const result = requestResultText(visit, flat?.label ?? null);
  const open = result === null;
  const purpose = VISIT_PURPOSE[visit.purpose];
  const pill = visitPill(visit);
  const resultTone = toneColors(colors, pill.tone);

  return (
    <Screen scroll>
      <Header title={open ? 'Visitor at the gate' : 'Visitor'} subtitle={flat?.label} onBack={back} />

      <Card style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={{ width: '100%', height: 280 }} resizeMode="cover" />
        ) : visit.photo_path ? (
          <View style={{ height: 280, backgroundColor: colors.surfaceMuted }} />
        ) : null}
        <View style={{ padding: space.lg, gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconBadge icon={purpose.icon} tone={open ? 'accent' : 'neutral'} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[type.title, { color: colors.text }]}>{visit.name}</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                {visit.pass_id ? 'Guest pass' : purpose.label} · {formatDateTime(visit.created_at)}
              </Text>
            </View>
          </View>
          <Pill label={pill.label} tone={pill.tone} icon={pill.icon} />
          {visit.entry_at ? (
            <View style={{ gap: space.sm }}>
              <InfoRow icon="enter-outline" label="Entered" value={formatTime(visit.entry_at)} />
              {visit.exit_at ? <InfoRow icon="exit-outline" label="Left" value={formatTime(visit.exit_at)} /> : null}
            </View>
          ) : null}
        </View>
      </Card>

      {open ? (
        <View style={{ gap: space.md }}>
          <Button
            title="Approve"
            icon="checkmark-circle"
            loading={busy === 'approved'}
            disabled={busy !== null}
            onPress={() => respond('approved')}
            style={{ minHeight: 64 }}
          />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button
              title="Deny"
              icon="close-circle"
              variant="danger"
              loading={busy === 'denied'}
              disabled={busy !== null}
              onPress={() => respond('denied')}
              style={{ flex: 1, minHeight: 60 }}
            />
            <Button
              title="Leave at gate"
              icon="cube"
              variant="secondary"
              loading={busy === 'leave_at_gate'}
              disabled={busy !== null}
              onPress={() => respond('leave_at_gate')}
              style={{ flex: 1, minHeight: 60 }}
            />
          </View>
        </View>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            padding: space.lg,
            borderRadius: radius.md,
            backgroundColor: resultTone.bg,
          }}>
          <IconBadge icon={pill.icon} tone={pill.tone} size={40} />
          <Text style={[type.heading, { color: resultTone.fg, flex: 1 }]}>{result}</Text>
        </View>
      )}
      {error ? <Banner text={error} /> : null}
    </Screen>
  );
}
