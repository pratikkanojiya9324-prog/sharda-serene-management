import Ionicons from '@expo/vector-icons/Ionicons';
import { flatLabel } from '@society-gate/shared';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { guardErrorText } from '@/lib/guardErrors';
import { timeAgo } from '@/lib/format';
import { sosStatusText, sosTypeLabel, type SosAlert } from '@/lib/sos';
import { supabase } from '@/lib/supabase';
import { useOpenSos } from '@/lib/useOpenSos';
import { Banner, Button, Input } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

const MAX_NOTE = 300;

const labelOf = (a: SosAlert) =>
  a.flats ? (a.flats.towers ? flatLabel(a.flats.towers.building, a.flats.towers.name, a.flats.number) : a.flats.number) : 'A flat';

/** The signed-in user's profile name, sent as the actor on ack / resolve (null if it cannot be read). */
async function profileName(): Promise<string | null> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const uid = s.session?.user.id;
    if (!uid) return null;
    const { data } = await supabase.from('profiles').select('name').eq('id', uid).maybeSingle();
    return data?.name?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Live SOS alerts for guards and admins, shown above the tabs so it is
 * visible on every screen. Renders nothing when there is nothing to show;
 * if the alerts cannot be loaded it says so instead of staying silent.
 */
export function SosBanner({ societyId }: { societyId: string | null }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { alerts, error, refetch } = useOpenSos(societyId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<SosAlert | null>(null);
  const [, setTick] = useState(0);
  const inFlight = useRef(false);

  // "2 min ago" keeps counting while the banner stays on screen.
  useEffect(() => {
    if (!alerts.length) return;
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [alerts.length]);

  async function ack(a: SosAlert) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyId(a.id);
    setErrors((e) => ({ ...e, [a.id]: '' }));
    try {
      const name = await profileName();
      const { error: err } = await supabase.rpc('ack_sos', { p_id: a.id, ...(name ? { p_actor_name: name } : {}) });
      if (err) setErrors((e) => ({ ...e, [a.id]: guardErrorText(err.message) }));
    } catch (e) {
      setErrors((x) => ({ ...x, [a.id]: guardErrorText((e as Error | null)?.message) }));
    } finally {
      setBusyId(null);
      inFlight.current = false;
      refetch();
    }
  }

  if (!societyId) return null;
  if (!alerts.length && !error) return null;

  return (
    <View style={{ backgroundColor: colors.danger, paddingTop: insets.top + space.sm, paddingHorizontal: space.md, paddingBottom: space.sm, gap: space.sm }}>
      {error ? (
        <Pressable onPress={refetch} accessibilityRole="button" accessibilityLabel="Retry loading SOS alerts">
          <Text style={[type.label, { color: '#FFFFFF' }]}>
            Can&apos;t check for SOS alerts. {error} Tap to retry.
          </Text>
        </Pressable>
      ) : null}
      {alerts.map((a) => {
        const raisedBy = a.raised_by_name?.trim();
        return (
          <View key={a.id} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Text style={{ fontSize: 22 }}>🚨</Text>
              <Text style={[type.heading, { color: colors.danger, flex: 1 }]} accessibilityLiveRegion="polite">
                {labelOf(a)} · {sosTypeLabel(a.type)} · {timeAgo(a.created_at)}
                {raisedBy ? ` · raised by ${raisedBy}` : ''}
              </Text>
            </View>
            {a.status === 'acknowledged' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Ionicons name="walk" size={18} color={colors.success} />
                <Text style={[type.label, { color: colors.success }]}>{sosStatusText(a)}</Text>
              </View>
            ) : null}
            {errors[a.id] ? <Banner text={errors[a.id]} /> : null}
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {a.status === 'open' ? (
                <Button title="On my way" icon="walk" loading={busyId === a.id} disabled={!!busyId} onPress={() => ack(a)} style={{ flex: 1 }} />
              ) : null}
              <Button title="Resolved" variant="secondary" icon="checkmark-circle" disabled={!!busyId} onPress={() => setResolving(a)} style={{ flex: 1 }} />
            </View>
          </View>
        );
      })}
      <ResolveSheet
        key={resolving?.id ?? 'none'}
        alert={resolving}
        onClose={() => setResolving(null)}
        onDone={() => {
          setResolving(null);
          refetch();
        }}
      />
    </View>
  );
}

/** Asks for an optional note, then resolves the alert. */
function ResolveSheet({ alert, onClose, onDone }: { alert: SosAlert | null; onClose: () => void; onDone: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function confirm() {
    if (!alert || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const name = await profileName();
      const { error: err } = await supabase.rpc('resolve_sos', {
        p_id: alert.id,
        ...(note.trim() ? { p_note: note.trim() } : {}),
        ...(name ? { p_actor_name: name } : {}),
      });
      if (err) {
        // Already closed by someone else: nothing left to do here, the list refreshes.
        if (err.message === 'sos_closed') return onDone();
        return setError(guardErrorText(err.message));
      }
      onDone();
    } catch (e) {
      setError(guardErrorText((e as Error | null)?.message));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal visible={!!alert} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={close} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            paddingHorizontal: space.xl,
            paddingTop: space.lg,
            paddingBottom: insets.bottom + space.lg,
            gap: space.md,
          }}>
          <Text style={[type.title, { color: colors.text }]}>Mark SOS resolved</Text>
          <Input label="Note (optional)" placeholder="What happened?" value={note} onChangeText={setNote} maxLength={MAX_NOTE} multiline />
          {error ? <Banner text={error} /> : null}
          <Button title="Resolve" icon="checkmark-circle" loading={busy} onPress={confirm} />
          <Button title="Cancel" variant="ghost" disabled={busy} onPress={close} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
