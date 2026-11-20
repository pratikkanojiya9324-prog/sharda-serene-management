import { normalizePhone } from '@society-gate/shared';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, Text, TextInput } from 'react-native';

import { useGuardSociety } from '@/lib/guardSociety';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';
import { attachVisitPhoto } from '@/lib/visitPhoto';

const PURPOSES = ['delivery', 'guest', 'cab', 'service', 'other'] as const;
type Purpose = (typeof PURPOSES)[number];
type Tower = { id: string; name: string };
type Flat = { id: string; number: string };

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1a56db',
        backgroundColor: selected ? '#1a56db' : '#fff',
      }}
    >
      <Text style={{ color: selected ? '#fff' : '#1a56db', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal contentContainerStyle={{ gap: 8 }} showsHorizontalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export default function NewVisit() {
  const router = useRouter();
  const { societyId, error: societyError } = useGuardSociety();
  const [towers, setTowers] = useState<Tower[]>([]);
  const [flats, setFlats] = useState<Flat[]>([]);
  const [towerId, setTowerId] = useState<string | null>(null);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [purpose, setPurpose] = useState<Purpose>('guest');
  const [photo, setPhoto] = useState<{ uri: string; width: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!societyId) return;
    supabase
      .from('towers')
      .select('id, name')
      .eq('society_id', societyId)
      .order('name')
      .then(({ data, error: err }) => (err ? setError(err.message) : setTowers(data ?? [])));
  }, [societyId]);

  useEffect(() => {
    setFlatId(null);
    setFlats([]);
    if (!towerId) return;
    supabase
      .from('flats')
      .select('id, number')
      .eq('tower_id', towerId)
      .order('number')
      .then(({ data, error: err }) => (err ? setError(err.message) : setFlats(data ?? [])));
  }, [towerId]);

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
    setError(null);
    if (!societyId || !flatId) return setError('Pick a tower and flat.');
    if (!name.trim()) return setError('Enter the visitor name.');
    let e164: string | null = null;
    if (phone.trim()) {
      try {
        e164 = normalizePhone(phone);
      } catch {
        return setError('Enter a valid 10-digit mobile number, or leave it blank.');
      }
    }
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
        pathname: '/visit/[id]',
        params: photoFailed ? { id: data.id, photo: 'failed' } : { id: data.id },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the visit');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={[ui.screen, { justifyContent: 'flex-start' }]}>
      {societyError ? <Text style={ui.error}>{societyError}</Text> : null}
      <Text style={ui.body}>Tower</Text>
      <ChipRow>
        {towers.map((t) => (
          <Chip key={t.id} label={t.name} selected={t.id === towerId} onPress={() => setTowerId(t.id)} />
        ))}
      </ChipRow>
      {towerId ? <Text style={ui.body}>Flat</Text> : null}
      <ChipRow>
        {flats.map((f) => (
          <Chip key={f.id} label={f.number} selected={f.id === flatId} onPress={() => setFlatId(f.id)} />
        ))}
      </ChipRow>
      <TextInput style={ui.input} placeholder="Visitor name" value={name} onChangeText={setName} />
      <TextInput
        style={ui.input}
        placeholder="Phone (optional)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <Text style={ui.body}>Purpose</Text>
      <ChipRow>
        {PURPOSES.map((p) => (
          <Chip key={p} label={p} selected={p === purpose} onPress={() => setPurpose(p)} />
        ))}
      </ChipRow>
      {photo ? <Image source={{ uri: photo.uri }} style={{ width: 160, height: 160, borderRadius: 8 }} /> : null}
      <Pressable style={ui.secondary} onPress={takePhoto}>
        <Text style={ui.secondaryText}>{photo ? 'Retake photo' : 'Take photo'}</Text>
      </Pressable>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Pressable style={[ui.button, busy && ui.buttonDisabled]} disabled={busy} onPress={submit}>
        <Text style={ui.buttonText}>{busy ? 'Sending...' : 'Notify resident'}</Text>
      </Pressable>
    </ScrollView>
  );
}
