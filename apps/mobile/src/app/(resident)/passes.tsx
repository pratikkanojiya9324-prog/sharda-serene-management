import type { Database } from '@society-gate/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Share, Text, TextInput, View } from 'react-native';

import { friendlyError } from '@/lib/errors';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

type Pass = Database['public']['Tables']['passes']['Row'];

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Parses 'YYYY-MM-DD HH:mm' as local time; null if malformed. */
function parseLocal(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return Number.isNaN(date.getTime()) ? null : date;
}

function defaultRange(): { from: string; to: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 0, 0);
  return { from: fmt(start), to: fmt(end) };
}

export default function PassesScreen() {
  const { flat } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [passes, setPasses] = useState<Pass[]>([]);
  const [guest, setGuest] = useState('');
  const [range, setRange] = useState(defaultRange);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('passes')
      .select('*')
      .eq('flat_id', flatId)
      .is('revoked_at', null)
      .gt('valid_to', new Date().toISOString())
      .order('valid_from');
    if (err) setError(friendlyError(err.message));
    else setPasses(data ?? []);
  }, [flatId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function create() {
    if (!flatId) return;
    setError(null);
    const from = parseLocal(range.from);
    const to = parseLocal(range.to);
    if (!from || !to) return setError('Use the format YYYY-MM-DD HH:mm');
    setBusy(true);
    const { error: err } = await supabase.rpc('create_pass', {
      p_flat_id: flatId,
      p_guest_name: guest.trim(),
      p_valid_from: from.toISOString(),
      p_valid_to: to.toISOString(),
    });
    setBusy(false);
    if (err) return setError(friendlyError(err.message));
    setGuest('');
    setRange(defaultRange());
    load();
  }

  async function revoke(id: string) {
    setError(null);
    const { error: err } = await supabase.rpc('revoke_pass', { p_pass_id: id });
    if (err) setError(friendlyError(err.message));
    else load();
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 12, backgroundColor: '#fff' }}
      data={passes}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <View style={{ gap: 10, marginBottom: 8 }}>
          <FlatSwitcher />
          <Text style={[ui.body, { fontWeight: '700' }]}>New guest pass</Text>
          <TextInput style={ui.input} placeholder="Guest name" value={guest} onChangeText={setGuest} />
          <Text style={ui.body}>Valid from (YYYY-MM-DD HH:mm)</Text>
          <TextInput style={ui.input} value={range.from} onChangeText={(from) => setRange((r) => ({ ...r, from }))} />
          <Text style={ui.body}>Valid until (YYYY-MM-DD HH:mm)</Text>
          <TextInput style={ui.input} value={range.to} onChangeText={(to) => setRange((r) => ({ ...r, to }))} />
          {error ? <Text style={ui.error}>{error}</Text> : null}
          <Pressable
            style={[ui.button, (busy || !guest.trim() || !flatId) && ui.buttonDisabled]}
            disabled={busy || !guest.trim() || !flatId}
            onPress={create}
          >
            <Text style={ui.buttonText}>{busy ? 'Creating...' : 'Create pass'}</Text>
          </Pressable>
          <Text style={[ui.body, { fontWeight: '700', marginTop: 8 }]}>
            {passes.length ? 'Active passes' : 'No active passes'}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 14, gap: 6 }}>
          <Text style={ui.body}>{item.guest_name}</Text>
          <Text style={{ fontSize: 40, fontWeight: '800', letterSpacing: 6, color: '#111' }}>{item.code}</Text>
          <Text style={ui.body}>
            {new Date(item.valid_from).toLocaleString()} – {new Date(item.valid_to).toLocaleString()}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              style={[ui.button, { flex: 1 }]}
              onPress={() =>
                Share.share({
                  message: `Hi ${item.guest_name}, show this code at the gate: ${item.code} (valid until ${new Date(item.valid_to).toLocaleString()})`,
                })
              }
            >
              <Text style={ui.buttonText}>Share</Text>
            </Pressable>
            <Pressable style={[ui.button, { flex: 1, backgroundColor: '#b91c1c' }]} onPress={() => revoke(item.id)}>
              <Text style={ui.buttonText}>Revoke</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}
