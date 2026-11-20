import Ionicons from '@expo/vector-icons/Ionicons';
import { flatLabel, normalizePhone } from '@society-gate/shared';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { loadFlatDirectory } from '@/lib/flatDirectory';
import { groupFlats, type FlatTree } from '@/lib/flatPicker';
import { guardErrorText } from '@/lib/guardErrors';
import { useGuardSociety } from '@/lib/guardSociety';
import { VISIT_PURPOSE } from '@/lib/status';
import { attachVisitPhoto } from '@/lib/visitPhoto';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, Header, Input, Screen, Select } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

const PURPOSES = ['delivery', 'guest', 'cab', 'service', 'other'] as const;
type Purpose = (typeof PURPOSES)[number];

export default function NewVisit() {
  const router = useRouter();
  const { colors } = useTheme();
  const { societyId, error: societyError } = useGuardSociety();
  const [tree, setTree] = useState<FlatTree>([]);
  const [building, setBuilding] = useState<string | null>(null);
  const [wing, setWing] = useState<string | null>(null);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState<Purpose>('guest');
  const [photo, setPhoto] = useState<{ uri: string; width: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // Synchronous guard: a fast double tap fires twice before `busy` re-renders,
  // which would create two visits and two pushes.
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
      // Only one building: nothing to choose.
      if (t.length === 1) {
        setBuilding(t[0].building);
        // ...and a single wing needs no choosing either.
        if (t[0].wings.length === 1) setWing(t[0].wings[0].wing);
      }
    });
    return () => {
      active = false;
    };
  }, [societyId]);

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
      setError('Camera permission is needed to take a visitor photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!result.canceled) setPhoto({ uri: result.assets[0].uri, width: result.assets[0].width });
  }

  async function submit() {
    if (inFlight.current) return;
    setError(null);
    if (!societyId || !flatId) return setError('Pick the building, wing and flat.');
    if (!name.trim()) return setError('Enter the visitor name.');
    let e164: string | null = null;
    if (phone.trim()) {
      try {
        e164 = normalizePhone(phone);
      } catch {
        return setError('Enter a valid 10-digit mobile number, or leave it blank.');
      }
    }
    inFlight.current = true;
    setBusy(true);
    try {
      // Create the visit first so the residents' push goes out at once; the photo follows.
      const { data, error: err } = await supabase.rpc('create_visit', {
        p_flat_id: flatId,
        p_name: name.trim(),
        // Generated arg types are non-nullable, but the RPC accepts null for optional phone/photo.
        p_phone: e164 as string,
        p_purpose: purpose,
        p_photo_path: null as unknown as string,
      });
      if (err) throw err;
      let photoFailed = false;
      if (photo) {
        try {
          await attachVisitPhoto(data.id, societyId, photo);
        } catch (e) {
          console.warn('[visit] photo not saved', e);
          photoFailed = true;
        }
      }
      router.replace({
        pathname: '/(guard)/visit/[id]',
        params: photoFailed ? { id: data.id, photo: 'failed' } : { id: data.id },
      });
    } catch (e) {
      setError(guardErrorText(e && typeof e === 'object' && 'message' in e ? String(e.message) : null));
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(guard)'));

  return (
    <Screen scroll>
      <Header overline="Gate" title="New visitor" subtitle="The flat gets a notification to approve" onBack={back} />
      {societyError ? <Banner text={societyError} /> : null}

      <Card>
        <Text style={[type.heading, { color: colors.text }]}>Visiting flat</Text>
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
        <Text style={[type.heading, { color: colors.text }]}>Visitor</Text>
        <Input label="Name" placeholder="Visitor name" value={name} onChangeText={setName} icon="person-outline" />
        <Input
          label="Phone (optional)"
          placeholder="10-digit mobile"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          icon="call-outline"
        />
        <Text style={[type.label, { color: colors.textMuted }]}>Purpose</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {PURPOSES.map((p) => {
            const active = p === purpose;
            const info = VISIT_PURPOSE[p];
            return (
              <Pressable
                key={p}
                onPress={() => setPurpose(p)}
                accessibilityRole="button"
                accessibilityLabel={info.label}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: 44,
                  paddingHorizontal: space.lg,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primary : pressed ? colors.surfaceMuted : colors.surface,
                })}>
                <Ionicons name={info.icon} size={16} color={active ? colors.onPrimary : colors.textMuted} />
                <Text style={[type.label, { color: active ? colors.onPrimary : colors.text }]}>{info.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={[type.heading, { color: colors.text }]}>Photo</Text>
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={{ width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
            resizeMode="cover"
            accessibilityLabel="Visitor photo"
          />
        ) : null}
        <Button
          title={photo ? 'Retake photo' : 'Take photo'}
          icon="camera-outline"
          variant="secondary"
          onPress={takePhoto}
        />
      </Card>

      {error ? <Banner text={error} /> : null}
      <Button title="Notify resident" icon="notifications" loading={busy} onPress={submit} />
    </Screen>
  );
}
