import { flatLabel, PARCEL_SELECT } from '@society-gate/shared';
import type { QueryData } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, SectionTitle, useFocusLoad } from '@/components/resident';
import { isSessionExpired, reportError } from '@/lib/errors';
import { formatDate, formatTime } from '@/lib/format';
import { guardErrorText } from '@/lib/guardErrors';
import { useGuardSociety } from '@/lib/guardSociety';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { useSignedUrl } from '@/lib/useSignedUrl';
import { Banner, Button, Card, EmptyState, Header, Input, Screen } from '@/theme/components';
import { radius, shadow, space, type, useTheme } from '@/theme/tokens';

function waitingParcels(societyId: string) {
  return supabase
    .from('parcels')
    .select(PARCEL_SELECT)
    .eq('society_id', societyId)
    .eq('status', 'at_gate')
    .order('created_at', { ascending: false });
}
type Row = QueryData<ReturnType<typeof waitingParcels>>[number];

const rowFlat = (r: Row) =>
  r.flats ? (r.flats.towers ? flatLabel(r.flats.towers.building, r.flats.towers.name, r.flats.number) : r.flats.number) : '—';

export default function Parcels() {
  const router = useRouter();
  const { colors } = useTheme();
  const { societyId, error: societyError } = useGuardSociety();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [handing, setHanding] = useState<Row | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    if (!societyId) return;
    const { data, error: err } = await waitingParcels(societyId);
    if (err) {
      setError(isSessionExpired(err) ? reportError(err) : guardErrorText(err.message));
      return false;
    }
    setError(null);
    setRows(data ?? []);
  }, [societyId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!societyId);
  const state = screenState({ loaded, error: error ?? loadFailure });

  useEffect(() => {
    if (!societyId) return;
    const channel = supabase
      .channel(`parcels-${societyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parcels', filter: `society_id=eq.${societyId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [societyId, load]);

  async function run(id: string, action: () => PromiseLike<{ error: { message: string } | null }>): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setActionError(null);
    setBusy(id);
    try {
      const { error: err } = await action();
      if (err) {
        setActionError(isSessionExpired(err) ? reportError(err) : guardErrorText(err.message));
        await load();
        return false;
      }
      await load();
      return true;
    } finally {
      setBusy(null);
      inFlight.current = false;
    }
  }

  async function confirmHandover() {
    if (!handing) return;
    const row = handing;
    // Blank name is sent as-is: the server answers invalid_name, shown in the sheet.
    const ok = await run(row.id, () =>
      supabase.rpc('collect_parcel', { p_parcel_id: row.id, p_collected_by_name: name.trim() }),
    );
    if (ok) {
      setHanding(null);
      setName('');
    }
  }

  const confirmReturn = (r: Row) =>
    Alert.alert('Return to courier?', `${r.courier} parcel for ${rowFlat(r)} will be marked as returned.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Returned', onPress: () => run(r.id, () => supabase.rpc('return_parcel', { p_parcel_id: r.id })) },
    ]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(guard)'));

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        overline="Gate"
        title="Parcels"
        subtitle="Waiting at the gate"
        onBack={back}
      />
      {societyError ? <Banner text={societyError} /> : null}
      {error && state === 'ready' ? <Banner text={error} /> : null}
      {actionError && !handing ? <Banner text={actionError} /> : null}
      <Button title="Log a parcel" icon="add-circle-outline" onPress={() => router.push('/(guard)/parcel')} />

      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        societyError ? null : <Loading />
      ) : rows.length ? (
        <>
          <SectionTitle title="Waiting" count={rows.length} />
          {rows.map((r) => (
            <ParcelCard
              key={r.id}
              row={r}
              busy={busy === r.id}
              onHandOver={() => {
                setActionError(null);
                setName('');
                setHanding(r);
              }}
              onReturn={() => confirmReturn(r)}
            />
          ))}
        </>
      ) : (
        <EmptyState icon="cube-outline" title="No parcels waiting" message="Parcels you log show up here until handed over." />
      )}

      <Modal visible={!!handing} transparent animationType="fade" onRequestClose={() => setHanding(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'center', padding: space.xl, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => setHanding(null)} />
          <View
            style={[
              { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.xl, gap: space.md },
              shadow(2),
            ]}>
            <Text style={[type.heading, { color: colors.text }]}>Handed over to</Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>
              {handing ? `${handing.courier} parcel for ${rowFlat(handing)}` : ''}
            </Text>
            <Input
              label="Name of person collecting"
              placeholder="Name"
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={60}
              icon="person-outline"
            />
            {actionError ? <Banner text={actionError} /> : null}
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setHanding(null)} />
              <Button
                title="Handed over"
                icon="checkmark"
                style={{ flex: 1 }}
                loading={!!handing && busy === handing.id}
                onPress={confirmHandover}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function ParcelCard({
  row,
  busy,
  onHandOver,
  onReturn,
}: {
  row: Row;
  busy: boolean;
  onHandOver: () => void;
  onReturn: () => void;
}) {
  const { colors } = useTheme();
  const url = useSignedUrl('parcel-photos', row.photo_path);
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {row.photo_path && url ? (
          <Image source={{ uri: url }} style={{ width: 56, height: 56, borderRadius: radius.md }} resizeMode="cover" />
        ) : (
          <IconBadge icon="cube" tone="accent" size={56} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>
            {row.courier}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{rowFlat(row)}</Text> · {formatDate(row.created_at)},{' '}
            {formatTime(row.created_at)}
          </Text>
          {row.note ? (
            <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={2}>
              {row.note}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button title="Handed over" icon="checkmark" style={{ flex: 1 }} loading={busy} onPress={onHandOver} />
        <Button title="Returned" icon="arrow-undo" variant="secondary" style={{ flex: 1 }} disabled={busy} onPress={onReturn} />
      </View>
    </Card>
  );
}
