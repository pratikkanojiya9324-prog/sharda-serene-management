import type { Database } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, Text, View } from 'react-native';

import { IconBadge, Loading, SectionTitle, useFocusLoad } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { actorLabel } from '@/lib/attribution';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Input, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

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
  const router = useRouter();
  const { colors } = useTheme();
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
  const { loaded, refreshing, onRefresh } = useFocusLoad(load, !!flatId);

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
      p_actor_name: (await getActorName()) ?? undefined,
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
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Header title="Guest passes" subtitle="Share a code; the guard lets your guest in" onBack={() => router.back()} />
      <FlatSwitcher />

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconBadge icon="ticket" tone="accent" />
          <Text style={[type.heading, { color: colors.text }]}>New guest pass</Text>
        </View>
        <Input label="Guest name" icon="person-outline" placeholder="e.g. Priya" value={guest} onChangeText={setGuest} />
        <Input
          label="Valid from (YYYY-MM-DD HH:mm)"
          icon="calendar-outline"
          value={range.from}
          onChangeText={(from) => setRange((r) => ({ ...r, from }))}
        />
        <Input
          label="Valid until (YYYY-MM-DD HH:mm)"
          icon="calendar-outline"
          value={range.to}
          onChangeText={(to) => setRange((r) => ({ ...r, to }))}
        />
        {error ? <Banner text={error} /> : null}
        <Button title="Create pass" icon="add-circle" loading={busy} disabled={!guest.trim() || !flatId} onPress={create} />
      </Card>

      <SectionTitle title="Active passes" count={passes.length || undefined} />
      {!loaded ? (
        <Loading />
      ) : passes.length ? (
        passes.map((p) => (
          <Card key={p.id}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.heading, { color: colors.text }]}>{p.guest_name}</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  Created by {actorLabel(p.created_by_name, flat?.label)}
                </Text>
              </View>
            </View>
            <View
              style={{
                alignItems: 'center',
                paddingVertical: space.lg,
                borderRadius: radius.md,
                backgroundColor: colors.primarySoft,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.primary,
              }}>
              <Text style={{ fontSize: 40, fontWeight: '800', letterSpacing: 8, color: colors.primary }} selectable>
                {p.code}
              </Text>
            </View>
            <Text style={[type.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              {formatDateTime(p.valid_from)} – {formatDateTime(p.valid_to)}
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Button
                title="Share"
                icon="share-social-outline"
                style={{ flex: 1 }}
                onPress={() =>
                  Share.share({
                    message: `Hi ${p.guest_name}, show this code at the gate: ${p.code} (valid until ${formatDateTime(p.valid_to)})`,
                  })
                }
              />
              <Button title="Revoke" icon="trash-outline" variant="danger" style={{ flex: 1 }} onPress={() => revoke(p.id)} />
            </View>
          </Card>
        ))
      ) : (
        <EmptyState icon="ticket-outline" title="No active passes" message="Create one above when you expect a guest." />
      )}
    </Screen>
  );
}
