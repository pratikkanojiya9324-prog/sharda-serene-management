import Ionicons from '@expo/vector-icons/Ionicons';
import { SOS_TYPES, type SosType } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { EmergencyContactCards, fetchEmergencyContacts, type Contact } from '@/components/EmergencyContacts';
import { NoFlatState } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { reportError } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { useResidentFlat } from '@/lib/residentFlat';
import { sosSendState, sosStatusText, sosTypeIcon, sosTypeLabel, type SosAlert, type SosStatus } from '@/lib/sos';
import { supabase } from '@/lib/supabase';
import { useFlatSos } from '@/lib/useOpenSos';
import { Banner, Button, Card, Header, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

const RANK: Record<SosStatus, number> = { open: 0, acknowledged: 1, resolved: 2, cancelled: 2 };

/** The newer alert; for the same alert, the further-along status (a stale copy never wins). */
function newest(a: SosAlert | null, b: SosAlert | null): SosAlert | null {
  if (!a || !b) return a ?? b;
  if (a.id === b.id) return RANK[b.status] > RANK[a.status] ? b : a;
  return b.created_at > a.created_at ? b : a;
}

export default function SosScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { type: typeParam } = useLocalSearchParams<{ type?: string }>();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const { alert: live, error: liveError, refetch } = useFlatSos(flatId);
  const [raised, setRaised] = useState<SosAlert | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [lastType, setLastType] = useState<SosType | null>(null);
  const inFlight = useRef(false);
  const started = useRef<string | null>(null);

  const alert = newest(live, raised);

  const send = useCallback(
    async (t: SosType) => {
      if (!flatId || inFlight.current) return;
      inFlight.current = true;
      setLastType(t);
      setBusy(true);
      setError(null);
      try {
        const actor = await getActorName();
        const { data, error: err } = await supabase.rpc('raise_sos', {
          p_flat_id: flatId,
          p_type: t,
          ...(actor ? { p_actor_name: actor } : {}),
        });
        if (err || !data) {
          setError(reportError(err ?? { message: '' }));
          return;
        }
        setRaised(data as unknown as SosAlert);
        refetch();
      } catch (e) {
        setError(reportError(e as { message?: string } | null));
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [flatId, refetch],
  );

  // Home passes the chosen type: send it once, then drop the param.
  useEffect(() => {
    if (!flatId || !typeParam) return;
    const t = SOS_TYPES.find((v) => v.value === typeParam)?.value;
    if (!t || started.current === typeParam) return;
    started.current = typeParam;
    router.setParams({ type: undefined });
    send(t);
  }, [flatId, typeParam, send, router]);

  // An error only hides an old alert from a previous emergency, never a live one.
  const state = sosSendState({ busy, error, alert: error && alert?.status !== 'open' && alert?.status !== 'acknowledged' ? null : alert });

  // The emergency numbers are what a failed SOS leaves the resident with.
  useEffect(() => {
    if (state !== 'failed') return;
    let active = true;
    fetchEmergencyContacts().then((res) => {
      if (!active) return;
      setContacts(res.contacts);
      setContactsError(res.error);
    });
    return () => {
      active = false;
    };
  }, [state]);

  function cancelAlert() {
    if (!alert) return;
    const id = alert.id;
    Alert.alert('Cancel this SOS?', 'Only cancel if it was a false alarm. The guards will be told.', [
      { text: 'Keep it active', style: 'cancel' },
      {
        text: 'Cancel — false alarm',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          setCancelError(null);
          try {
            const { data, error: err } = await supabase.rpc('cancel_sos', { p_id: id });
            if (err || !data) {
              setCancelError(reportError(err ?? { message: '' }));
              return;
            }
            setRaised(data as unknown as SosAlert);
            refetch();
          } catch (e) {
            setCancelError(reportError(e as { message?: string } | null));
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)'));

  if (!flat && !loading) {
    return (
      <Screen>
        <NoFlatState message={flatError} onRetry={reload} />
      </Screen>
    );
  }

  return (
    <Screen scroll edges={['top']}>
      <Header overline="Emergency" title="SOS" onBack={back} />
      {liveError && state !== 'failed' ? <Banner text={`Couldn't refresh the status. ${liveError}`} /> : null}

      {state === 'sending' ? (
        <Card style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl }}>
          <Ionicons name="radio" size={48} color={colors.danger} />
          <Text style={[type.title, { color: colors.danger }]}>Sending SOS…</Text>
          <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>Alerting the guards and the office.</Text>
        </Card>
      ) : null}

      {state === 'failed' ? (
        <>
          <View style={{ backgroundColor: colors.danger, borderRadius: radius.lg, padding: space.xl, gap: space.md }}>
            <Ionicons name="warning" size={40} color="#FFFFFF" />
            <Text style={[type.title, { color: '#FFFFFF' }]}>Couldn&apos;t send SOS</Text>
            <Text style={[type.body, { color: '#FFFFFF' }]}>{error}</Text>
            <Text style={[type.body, { color: '#FFFFFF' }]}>Call the numbers below now, or try again.</Text>
            <Button
              title="Try again"
              icon="refresh"
              onPress={() => lastType && send(lastType)}
              disabled={!lastType}
            />
          </View>
          {contactsError ? <Banner text={contactsError} /> : null}
          <EmergencyContactCards contacts={contacts} />
        </>
      ) : null}

      {state === 'active' && alert ? (
        <>
          <View style={{ backgroundColor: colors.danger, borderRadius: radius.lg, padding: space.xl, gap: space.sm }}>
            <Ionicons name={sosTypeIcon(alert.type)} size={40} color="#FFFFFF" />
            <Text style={[type.title, { color: '#FFFFFF' }]}>{sosTypeLabel(alert.type)} SOS</Text>
            <Text style={[type.heading, { color: '#FFFFFF' }]} accessibilityLiveRegion="polite">
              {sosStatusText(alert)}
            </Text>
            <Text style={[type.caption, { color: '#FFFFFF' }]}>Sent {timeAgo(alert.created_at)}</Text>
          </View>
          {cancelError ? <Banner text={cancelError} /> : null}
          <Button title="Cancel — false alarm" variant="danger" icon="close-circle" loading={cancelling} onPress={cancelAlert} />
        </>
      ) : null}

      {state === 'done' && alert ? (
        <Card style={{ gap: space.sm }}>
          <Text style={[type.overline, { color: colors.textSubtle }]}>{sosTypeLabel(alert.type).toUpperCase()} SOS</Text>
          <Text style={[type.title, { color: colors.text }]}>{sosStatusText(alert)}</Text>
          {alert.status === 'resolved' && alert.resolved_by_name ? (
            <Text style={[type.body, { color: colors.textMuted }]}>By {alert.resolved_by_name}</Text>
          ) : null}
          {alert.resolved_note ? <Text style={[type.body, { color: colors.textMuted }]}>{alert.resolved_note}</Text> : null}
          <Button title="Back to home" variant="secondary" onPress={back} />
        </Card>
      ) : null}

      {state === 'idle' ? (
        <Card style={{ gap: space.md }}>
          <Text style={[type.body, { color: colors.textMuted }]}>
            No SOS is active. To send one, hold the SOS button on Home for 2 seconds.
          </Text>
          <Button title="Back to home" variant="secondary" onPress={back} />
        </Card>
      ) : null}
    </Screen>
  );
}
