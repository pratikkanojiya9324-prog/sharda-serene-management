import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Share, Text, View } from 'react-native';

import { HelperAvatar } from '@/components/HelperAvatar';
import { ErrorState, InfoRow, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { reportError } from '@/lib/errors';
import { loadFlatHelpers, type FlatHelper } from '@/lib/flatHelpers';
import { formatDate, formatPhone, formatTime } from '@/lib/format';
import { attendanceSummary, helperTypeLabel, insideNow, monthStartOf, rowsOnDay } from '@/lib/helpers';
import { useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

export default function HelperDetail() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flat, loading: flatLoading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [helper, setHelper] = useState<FlatHelper | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!flatId) return;
    const res = await loadFlatHelpers(flatId, monthStartOf());
    if (res.error !== null) {
      setLocalError(res.error);
      return false;
    }
    setLocalError(null);
    setHelper(res.helpers.find((h) => h.id === id) ?? null);
  }, [flatId, id]);
  const { loaded, refreshing, onRefresh, error: hookError } = useFocusLoad(load, !!flatId);
  const error = localError ?? hookError;
  const state = screenState({ loaded, error, needsFlat: true, flatLoading, hasFlat: !!flat });

  function confirmRemove() {
    if (!helper || !flatId) return;
    Alert.alert(`Remove ${helper.name}?`, 'They will no longer be linked to your flat, and you will not see their attendance.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: remove },
    ]);
  }

  async function remove() {
    if (!helper || !flatId) return;
    setBusy(true);
    setActionError(null);
    try {
      const { error: err } = await supabase.rpc('remove_helper_from_flat', { p_helper_id: helper.id, p_flat_id: flatId });
      if (err) return setActionError(reportError(err));
      router.replace('/(resident)/daily-help');
    } finally {
      setBusy(false);
    }
  }

  const now = new Date();
  const rows = helper ? [...helper.helper_attendance].sort((a, b) => b.entry_at.localeCompare(a.entry_at)) : [];
  const today = rowsOnDay(rows, now).reverse();
  const { daysPresent } = attendanceSummary(rows, monthStartOf(now));

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        title={helper?.name ?? 'Daily help'}
        subtitle={helper ? helperTypeLabel(helper.type) : undefined}
        onBack={() => router.back()}
      />
      {state === 'no_flat' ? (
        <NoFlatState message={flatError} onRetry={reload} />
      ) : state === 'error' ? (
        <ErrorState message={error ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : !helper ? (
        <EmptyState icon="person-outline" title="Not found" message="This person is no longer in your daily help list." />
      ) : (
        <>
          {error ? <Banner text={error} /> : null}
          <Card style={{ alignItems: 'center' }}>
            <HelperAvatar photoPath={helper.photo_path} type={helper.type} size={96} />
            {!helper.active ? <Pill label="Blocked by the society office" tone="danger" icon="ban" /> : null}
            {insideNow(helper.helper_attendance) ? <Pill label="Inside now" tone="success" icon="enter" /> : null}
            <Text style={[type.caption, { color: colors.textMuted }]}>Gate code</Text>
            <View
              style={{
                alignSelf: 'stretch',
                alignItems: 'center',
                paddingVertical: space.lg,
                borderRadius: radius.md,
                backgroundColor: colors.primarySoft,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: colors.primary,
              }}>
              <Text style={{ fontSize: 40, fontWeight: '800', letterSpacing: 8, color: colors.primary }} selectable>
                {helper.entry_code}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' }}>
              <Button
                title="Share"
                icon="share-social-outline"
                style={{ flex: 1 }}
                onPress={() => Share.share({ message: `${helper.name}'s Sharda Serene gate code: ${helper.entry_code}` })}
              />
              <Button
                title="Call"
                icon="call-outline"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => Linking.openURL(`tel:${helper.phone}`)}
              />
            </View>
          </Card>

          <Card>
            <InfoRow icon="call" label="Phone" value={formatPhone(helper.phone)} />
            <InfoRow icon="calendar" label="This month" value={`${daysPresent} day${daysPresent === 1 ? '' : 's'}`} />
          </Card>

          <SectionTitle title="Today" />
          {today.length ? (
            <Card>
              {today.map((r) => (
                <InfoRow
                  key={r.id}
                  icon="time-outline"
                  label={`In ${formatTime(r.entry_at)}`}
                  value={r.exit_at ? `Out ${formatTime(r.exit_at)}` : 'Still inside'}
                />
              ))}
            </Card>
          ) : (
            <Card>
              <Text style={[type.body, { color: colors.textMuted }]}>Not at the gate today.</Text>
            </Card>
          )}

          <SectionTitle title="This month" count={rows.length || undefined} />
          {rows.length ? (
            <Card>
              {rows.map((r) => (
                <InfoRow
                  key={r.id}
                  label={`${formatDate(r.entry_at)}, ${formatTime(r.entry_at)}`}
                  value={r.exit_at ? `Out ${formatTime(r.exit_at)}` : 'Inside'}
                />
              ))}
            </Card>
          ) : (
            <Card>
              <Text style={[type.body, { color: colors.textMuted }]}>No visits recorded this month.</Text>
            </Card>
          )}

          {actionError ? <Banner text={actionError} /> : null}
          <Button title="Remove from my flat" icon="trash-outline" variant="danger" loading={busy} onPress={confirmRemove} />
        </>
      )}
    </Screen>
  );
}
