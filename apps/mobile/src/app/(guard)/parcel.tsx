import Ionicons from '@expo/vector-icons/Ionicons';
import { COURIERS, flatLabel } from '@society-gate/shared';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { Chips } from '@/components/resident';
import { isSessionExpired, reportError } from '@/lib/errors';
import { loadFlatDirectory } from '@/lib/flatDirectory';
import { groupFlats, type FlatTree } from '@/lib/flatPicker';
import { guardErrorText } from '@/lib/guardErrors';
import { useGuardSociety } from '@/lib/guardSociety';
import { uploadSocietyPhoto } from '@/lib/photoUpload';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, Header, Input, Screen, Select } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

const OTHER = 'Other';

export default function LogParcel() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ flatId?: string; visitId?: string; courier?: string }>();
  const { societyId, error: societyError } = useGuardSociety();
  const [tree, setTree] = useState<FlatTree>([]);
  const [building, setBuilding] = useState<string | null>(null);
  const [wing, setWing] = useState<string | null>(null);
  const [flatId, setFlatId] = useState<string | null>(params.flatId ?? null);
  const initialCourier = params.courier?.trim() ?? '';
  const known = (COURIERS as readonly string[]).includes(initialCourier);
  const [courierChip, setCourierChip] = useState<string | null>(known ? initialCourier : initialCourier ? OTHER : null);
  const [otherCourier, setOtherCourier] = useState(known ? '' : initialCourier);
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!societyId) return;
    let active = true;
    loadFlatDirectory(societyId).then(({ data, error: err }) => {
      if (!active) return;
      if (err) return setError(guardErrorText(err.message));
      const t = groupFlats(data);
      setTree(t);
      // Prefilled flat: open its building and wing.
      if (params.flatId) {
        for (const b of t) {
          for (const w of b.wings) {
            if (w.flats.some((f) => f.id === params.flatId)) {
              setBuilding(b.building);
              setWing(w.wing);
              return;
            }
          }
        }
      }
      if (t.length === 1) {
        setBuilding(t[0].building);
        if (t[0].wings.length === 1) setWing(t[0].wings[0].wing);
      }
    });
    return () => {
      active = false;
    };
  }, [societyId, params.flatId]);

  const wings = useMemo(() => tree.find((b) => b.building === building)?.wings ?? [], [tree, building]);
  const flats = useMemo(() => wings.find((w) => w.wing === wing)?.flats ?? [], [wings, wing]);
  const selectedFlat = flats.find((f) => f.id === flatId) ?? null;

  function chooseBuilding(b: string) {
    if (b === building) return;
    setBuilding(b);
    const ws = tree.find((x) => x.building === b)?.wings ?? [];
    setWing(ws.length === 1 ? ws[0].wing : null);
    setFlatId(null);
  }

  function chooseWing(w: string) {
    if (w === wing) return;
    setWing(w);
    setFlatId(null);
  }

  async function takePhoto() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera permission is needed to take a parcel photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  }

  async function submit() {
    if (inFlight.current) return;
    setError(null);
    if (!societyId || !flatId) return setError('Pick the building, wing and flat.');
    if (!courierChip) return setError('Choose the courier.');
    const courier = courierChip === OTHER ? otherCourier.trim() : courierChip;
    if (!courier) return setError(guardErrorText('invalid_courier'));
    inFlight.current = true;
    setBusy(true);
    try {
      let photoPath: string | null = null;
      if (photo) photoPath = await uploadSocietyPhoto('parcel-photos', `${societyId}/${flatId}`, photo);
      const { error: err } = await supabase.rpc('log_parcel', {
        p_flat_id: flatId,
        p_courier: courier,
        // Generated arg types are non-nullable, but the RPC accepts null for the optional note/photo.
        p_note: (note.trim() || null) as string,
        p_photo_path: photoPath as string,
        ...(params.visitId ? { p_visit_id: params.visitId } : {}),
      });
      if (err) throw err;
      router.replace('/(guard)/parcels');
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : null;
      setError(isSessionExpired(e as { message?: string }) ? reportError(e as { message?: string }) : guardErrorText(msg));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(guard)'));

  return (
    <Screen scroll>
      <Header overline="Gate" title="Log parcel" subtitle="The flat gets a notification" onBack={back} />
      {societyError ? <Banner text={societyError} /> : null}

      <Card>
        <Text style={[type.heading, { color: colors.text }]}>For flat</Text>
        <Select
          label="Building"
          placeholder="Choose building"
          value={building}
          options={tree.map((b) => ({ value: b.building, label: b.building }))}
          onChange={chooseBuilding}
          icon="business-outline"
        />
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Select
            label="Wing"
            placeholder="Wing"
            value={wing}
            options={wings.map((w) => ({ value: w.wing, label: `Wing ${w.wing}` }))}
            onChange={chooseWing}
            disabled={!building}
            icon="git-branch-outline"
            style={{ flex: 1 }}
          />
          <Select
            label="Flat"
            placeholder="Flat"
            value={flatId}
            options={flats.map((f) => ({ value: f.id, label: f.number }))}
            onChange={setFlatId}
            disabled={!wing}
            icon="home-outline"
            columns={3}
            sheetTitle={building && wing ? `${building} · Wing ${wing}` : 'Flat'}
            style={{ flex: 1 }}
          />
        </View>
        {selectedFlat && building && wing ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.sm,
              padding: space.md,
              borderRadius: radius.sm,
              backgroundColor: colors.primarySoft,
            }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={[type.heading, { color: colors.primary }]}>{flatLabel(building, wing, selectedFlat.number)}</Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <Text style={[type.heading, { color: colors.text }]}>Courier</Text>
        <Chips
          options={COURIERS.map((c) => ({ value: c, label: c }))}
          value={(courierChip ?? '') as (typeof COURIERS)[number]}
          onChange={setCourierChip}
        />
        {courierChip === OTHER ? (
          <Input
            label="Courier name"
            placeholder="Who delivered it?"
            value={otherCourier}
            onChangeText={setOtherCourier}
            maxLength={40}
            icon="cube-outline"
          />
        ) : null}
        <Input
          label="Note (optional)"
          placeholder="e.g. Big box, left with security"
          value={note}
          onChangeText={setNote}
          maxLength={200}
          icon="document-text-outline"
        />
      </Card>

      <Card>
        <Text style={[type.heading, { color: colors.text }]}>Photo (optional)</Text>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={{ width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
            resizeMode="cover"
            accessibilityLabel="Parcel photo"
          />
        ) : null}
        <Button
          title={photo ? 'Retake photo' : 'Take photo'}
          icon="camera-outline"
          variant="secondary"
          onPress={takePhoto}
        />
        {photo ? <Button title="Remove photo" variant="ghost" onPress={() => setPhoto(null)} /> : null}
      </Card>

      {error ? <Banner text={error} /> : null}
      <Button title="Save parcel" icon="checkmark" loading={busy} onPress={submit} />
    </Screen>
  );
}
