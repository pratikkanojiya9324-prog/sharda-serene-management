import { normalizePhone } from '@society-gate/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';

import { friendlyError } from '@/lib/errors';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

type Member = { profile_id: string; profiles: { name: string; phone: string } | null };

export default function HouseholdScreen() {
  const { flat } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('flat_residents')
      .select('profile_id, profiles(name, phone)')
      .eq('flat_id', flatId)
      .order('created_at');
    if (err) setError(friendlyError(err.message));
    else setMembers((data ?? []) as unknown as Member[]);
  }, [flatId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function add() {
    if (!flatId) return;
    setError(null);
    setNotice(null);
    let e164: string;
    try {
      e164 = normalizePhone(phone);
    } catch (e) {
      return setError(friendlyError(e instanceof Error ? e.message : 'invalid_phone'));
    }
    setBusy(true);
    const { error: err } = await supabase.rpc('add_household_member', {
      p_flat_id: flatId,
      p_name: name.trim(),
      p_phone: e164,
    });
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setNotice(`${name.trim()} can now log in with ${e164}`);
    setName('');
    setPhone('');
    load();
  }

  const canAdd = !busy && !!name.trim() && !!phone.trim() && !!flatId;
  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10, backgroundColor: '#fff' }}
      data={members}
      keyExtractor={(m) => m.profile_id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 8 }}>
          <FlatSwitcher />
          <Text style={[ui.body, { fontWeight: '700' }]}>Add a family member</Text>
          <TextInput style={ui.input} placeholder="Name" value={name} onChangeText={setName} />
          <TextInput
            style={ui.input}
            placeholder="Mobile number"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          {error ? <Text style={ui.error}>{error}</Text> : null}
          {notice ? <Text style={ui.body}>{notice}</Text> : null}
          <Pressable style={[ui.button, !canAdd && ui.buttonDisabled]} disabled={!canAdd} onPress={add}>
            <Text style={ui.buttonText}>{busy ? 'Adding...' : 'Add member'}</Text>
          </Pressable>
          <Text style={[ui.body, { fontWeight: '700', marginTop: 8 }]}>Living here</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14 }}>
          <Text style={[ui.body, { fontWeight: '700' }]}>{item.profiles?.name ?? 'Resident'}</Text>
          <Text style={ui.body}>{item.profiles?.phone ?? ''}</Text>
        </View>
      )}
    />
  );
}
