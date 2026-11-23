import Ionicons from '@expo/vector-icons/Ionicons';
import { HELPER_TYPES, normalizePhone, type HelperType } from '@society-gate/shared';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { getActorName } from '@/lib/actor';
import { friendlyError, reportError } from '@/lib/errors';
import { uploadSocietyPhoto } from '@/lib/photoUpload';
import { useResidentFlat } from '@/lib/residentFlat';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, Header, Input, Screen, Select } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

export default function NewHelperScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat } = useResidentFlat();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [helperType, setHelperType] = useState<HelperType | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  // A retry after a failed save reuses the photo already uploaded.
  const uploaded = useRef<{ uri: string; path: string } | null>(null);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      setError('Camera permission is needed to take a photo.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function submit() {
    if (!flat || !helperType || !name.trim() || inFlight.current) return;
    setError(null);
    let e164: string;
    try {
      e164 = normalizePhone(phone);
    } catch {
      return setError(friendlyError('invalid_phone'));
    }
    inFlight.current = true;
    setBusy(true);
    try {
      let photoPath: string | undefined;
      if (photoUri) {
        if (uploaded.current?.uri === photoUri) photoPath = uploaded.current.path;
        else {
          try {
            photoPath = await uploadSocietyPhoto('helper-photos', flat.societyId, photoUri);
            uploaded.current = { uri: photoUri, path: photoPath };
          } catch {
            return setError('The photo could not be uploaded. Try again, or remove the photo.');
          }
        }
      }
      const { data, error: err } = await supabase.rpc('add_helper', {
        p_flat_id: flat.id,
        p_name: name.trim(),
        p_phone: e164,
        p_type: helperType,
        p_photo_path: photoPath,
        p_actor_name: (await getActorName()) ?? undefined,
      });
      // A failed save keeps everything typed so it can be retried.
      if (err || !data) return setError(reportError(err ?? { message: '' }));
      router.replace({ pathname: '/(resident)/daily-help/[id]', params: { id: data.id } });
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const canSubmit = !!flat && !!helperType && !!name.trim() && !!phone.trim() && !busy;

  return (
    <Screen scroll edges={['top']}>
      <Header title="Add daily help" subtitle={flat?.label} onBack={() => router.back()} />
      <Card>
        <Input label="Name" icon="person-outline" placeholder="e.g. Sunita" value={name} onChangeText={setName} maxLength={60} />
        <Input
          label="Mobile number"
          icon="call-outline"
          placeholder="10-digit number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          maxLength={16}
        />
        <Select
          label="Type"
          icon="briefcase-outline"
          placeholder="Choose a type"
          value={helperType}
          options={HELPER_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          onChange={(v) => setHelperType(v as HelperType)}
        />
        <Text style={[type.label, { color: colors.textMuted }]}>Photo (optional)</Text>
        {photoUri ? (
          <View>
            <Image source={{ uri: photoUri }} style={{ width: '100%', height: 200, borderRadius: radius.md }} resizeMode="cover" />
            <Pressable
              onPress={() => setPhotoUri(null)}
              accessibilityRole="button"
              accessibilityLabel="Remove photo"
              hitSlop={8}
              style={{
                position: 'absolute',
                top: space.sm,
                right: space.sm,
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: colors.overlay,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button title="Camera" icon="camera-outline" variant="secondary" style={{ flex: 1 }} onPress={() => pick('camera')} />
            <Button title="Gallery" icon="images-outline" variant="secondary" style={{ flex: 1 }} onPress={() => pick('library')} />
          </View>
        )}
      </Card>
      {error ? <Banner text={error} /> : null}
      <Button title="Add" icon="person-add" loading={busy} disabled={!canSubmit} onPress={submit} />
    </Screen>
  );
}
