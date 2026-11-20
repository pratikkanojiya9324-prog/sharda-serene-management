import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { getActorName } from '@/lib/actor';
import { actorLabel } from '@/lib/attribution';
import { uploadComplaintPhoto } from '@/lib/complaintPhoto';
import { friendlyError } from '@/lib/errors';
import { useResidentFlat } from '@/lib/residentFlat';
import { COMPLAINT_CATEGORIES } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, Header, Input, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

type Category = Database['public']['Enums']['complaint_category'];
type Photo = { uri: string; width: number };

export default function NewComplaintScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat } = useResidentFlat();
  const [category, setCategory] = useState<Category | null>(null);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [actor, setActor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous guard against a double tap creating two complaints.
  const inFlight = useRef(false);

  useFocusEffect(
    useCallback(() => {
      getActorName().then(setActor);
    }, []),
  );

  async function pick(source: 'camera' | 'library') {
    setError(null);
    // The gallery uses the system photo picker, which needs no permission.
    if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) {
      setError('Camera permission is needed to take a photo.');
      return;
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7 };
    const result =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) setPhoto({ uri: result.assets[0].uri, width: result.assets[0].width });
  }

  async function submit() {
    if (!flat || !category || !description.trim() || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      let photoPath: string | undefined;
      if (photo) {
        try {
          photoPath = await uploadComplaintPhoto(flat.societyId, flat.id, photo);
        } catch {
          setError('The photo could not be uploaded. Try again, or remove the photo.');
          return;
        }
      }
      const { data, error: err } = await supabase.rpc('create_complaint', {
        p_flat_id: flat.id,
        p_category: category,
        p_description: description.trim(),
        p_photo_path: photoPath,
        p_actor_name: (await getActorName()) ?? undefined,
      });
      if (err || !data) {
        setError(friendlyError(err?.message ?? ''));
        return;
      }
      router.replace({ pathname: '/(resident)/complaints/[id]', params: { id: data.id } });
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const canSubmit = !!flat && !!category && !!description.trim() && !busy;

  return (
    <Screen scroll edges={['top']}>
      <Header title="Raise a complaint" subtitle={flat?.label} onBack={() => router.back()} />

      <Card>
        <Text style={[type.label, { color: colors.textMuted }]}>What is it about?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {COMPLAINT_CATEGORIES.map((c) => {
            const active = c.value === category;
            return (
              <Pressable
                key={c.value}
                onPress={() => setCategory(c.value)}
                accessibilityRole="button"
                accessibilityLabel={c.label}
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  flexBasis: '30%',
                  flexGrow: 1,
                  alignItems: 'center',
                  gap: 6,
                  paddingVertical: space.md,
                  borderRadius: radius.md,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceMuted : colors.surface,
                })}>
                <Ionicons name={c.icon} size={24} color={active ? colors.primary : colors.textMuted} />
                <Text style={[type.label, { color: active ? colors.primary : colors.text }]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Input
          label="Describe the problem"
          placeholder="e.g. Kitchen tap leaking since morning"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          style={{ minHeight: 110, textAlignVertical: 'top' }}
        />
        <Text style={[type.label, { color: colors.textMuted }]}>Photo (optional)</Text>
        {photo ? (
          <View>
            <Image source={{ uri: photo.uri }} style={{ width: '100%', height: 200, borderRadius: radius.md }} resizeMode="cover" />
            <Pressable
              onPress={() => setPhoto(null)}
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

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.xs }}>
        <Ionicons name="person-circle-outline" size={18} color={colors.textSubtle} />
        <Text style={[type.caption, { color: colors.textMuted }]}>Raised as {actorLabel(actor, flat?.label)}</Text>
      </View>
      {error ? <Banner text={error} /> : null}
      <Button title="Submit complaint" icon="send" loading={busy} disabled={!canSubmit} onPress={submit} />
    </Screen>
  );
}
