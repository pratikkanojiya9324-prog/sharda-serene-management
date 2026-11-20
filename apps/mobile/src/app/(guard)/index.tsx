import Ionicons from '@expo/vector-icons/Ionicons';
import { flatLabel, GUARD_TODAY_VISITS_SELECT } from '@society-gate/shared';
import type { QueryData } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { IconBadge, Loading, SectionTitle, useFocusLoad } from '@/components/resident';
import { formatDate, formatTime } from '@/lib/format';
import { guardErrorText } from '@/lib/guardErrors';
import { useGuardSociety } from '@/lib/guardSociety';
import { signOut } from '@/lib/signOut';
import { VISIT_PURPOSE, visitPill } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Pill, Screen, type IconName } from '@/theme/components';
import { radius, shadow, space, type, useTheme } from '@/theme/tokens';

function todayVisits(societyId: string, since: string) {
  return supabase
    .from('visits')
    .select(GUARD_TODAY_VISITS_SELECT)
    .eq('society_id', societyId)
    .gte('created_at', since)
    .order('created_at', { ascending: false });
}
type Row = QueryData<ReturnType<typeof todayVisits>>[number];

const rowFlat = (r: Row) =>
  r.flats ? (r.flats.towers ? flatLabel(r.flats.towers.building, r.flats.towers.name, r.flats.number) : r.flats.number) : '—';

export default function GuardHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { societyId, error: societyError } = useGuardSociety();
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!societyId) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { data, error: err } = await todayVisits(societyId, startOfDay.toISOString());
    if (err) setError(guardErrorText(err.message));
    else {
      setError(null);
      setRows(data ?? []);
    }
  }, [societyId]);
  const { loaded, refreshing, onRefresh } = useFocusLoad(load, !!societyId);

  // Keep the list fresh while the screen is mounted.
  useEffect(() => {
    if (!societyId) return;
    const channel = supabase
      .channel(`visits-${societyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits', filter: `society_id=eq.${societyId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [societyId, load]);

  const waiting = rows.filter((r) => r.status === 'pending' && !r.manual_outcome).length;
  const inside = rows.filter((r) => r.status === 'approved' || r.manual_outcome === 'allowed').length;

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'The next guard signs in with their own username.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <Screen scroll padded={false} edges={['bottom']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        variant="hero"
        icon="shield-checkmark"
        overline="Gate"
        title="Today"
        subtitle={`${formatDate(new Date().toISOString())} · ${rows.length} visitor${rows.length === 1 ? '' : 's'}`}
      />
      <View style={{ paddingHorizontal: space.xl, marginTop: -48, gap: space.md, paddingBottom: space.xxl }}>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <ActionTile icon="person-add" label="New visitor" primary onPress={() => router.push('/(guard)/new-visit')} />
          <ActionTile icon="keypad" label="Pass code" onPress={() => router.push('/(guard)/pass')} />
        </View>

        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Stat label="Waiting" value={waiting} tone={waiting ? colors.warning : colors.textMuted} />
          <Stat label="Approved" value={inside} tone={colors.success} />
        </View>

        {societyError ? <Banner text={societyError} /> : null}
        {error ? <Banner text={error} /> : null}

        <SectionTitle title="Today's visitors" />
        {!loaded ? (
          societyError ? null : <Loading />
        ) : rows.length ? (
          rows.map((r) => (
            <VisitorCard
              key={r.id}
              row={r}
              onPress={() => router.push({ pathname: '/(guard)/visit/[id]', params: { id: r.id } })}
            />
          ))
        ) : (
          <EmptyState icon="walk-outline" title="No visitors yet today" message="Tap New visitor when someone arrives." />
        )}

        <Button title="Sign out" icon="log-out-outline" variant="ghost" onPress={confirmSignOut} />
      </View>
    </Screen>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  const fg = primary ? colors.onPrimary : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flex: 1,
          minHeight: 112,
          borderRadius: radius.lg,
          padding: space.lg,
          justifyContent: 'space-between',
          backgroundColor: primary ? (pressed ? colors.primaryPressed : colors.primary) : pressed ? colors.surfaceMuted : colors.surface,
          borderWidth: primary ? 0 : 1,
          borderColor: colors.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        shadow(2),
      ]}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primary ? 'rgba(255,255,255,0.18)' : colors.primarySoft,
        }}>
        <Ionicons name={icon} size={24} color={fg} />
      </View>
      <Text style={[type.heading, { color: primary ? colors.onPrimary : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, gap: 2, paddingVertical: space.md }}>
      <Text style={[type.title, { color: tone }]}>{value}</Text>
      <Text style={[type.caption, { color: colors.textMuted }]}>{label}</Text>
    </Card>
  );
}

function VisitorCard({ row, onPress }: { row: Row; onPress: () => void }) {
  const { colors } = useTheme();
  const purpose = VISIT_PURPOSE[row.purpose];
  const status = visitPill(row);
  const flat = rowFlat(row);
  return (
    <Card onPress={onPress} accessibilityLabel={`${row.name} for ${flat}, ${status.label}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconBadge icon={purpose.icon} tone={status.tone} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>
            {row.name}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>{flat}</Text> · {purpose.label} ·{' '}
            {formatTime(row.created_at)}
          </Text>
        </View>
        <Pill label={status.label} tone={status.tone} icon={status.icon} />
      </View>
    </Card>
  );
}
