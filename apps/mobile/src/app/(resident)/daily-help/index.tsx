import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { HelperAvatar } from '@/components/HelperAvatar';
import { ErrorState, Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { loadFlatHelpers, type FlatHelper } from '@/lib/flatHelpers';
import { formatTime } from '@/lib/format';
import { attendanceSummary, helperTypeLabel, insideNow, monthStartOf, rowsOnDay } from '@/lib/helpers';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { Banner, Button, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

export default function DailyHelpList() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading: flatLoading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [helpers, setHelpers] = useState<FlatHelper[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!flatId) return;
    const res = await loadFlatHelpers(flatId, monthStartOf());
    if (res.error !== null) {
      setLocalError(res.error);
      return false;
    }
    setLocalError(null);
    setHelpers(res.helpers);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: hookError } = useFocusLoad(load, !!flatId);
  const error = localError ?? hookError;
  const state = screenState({ loaded, error, needsFlat: true, flatLoading, hasFlat: !!flat });

  const now = new Date();
  const month = monthStartOf(now);

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Header title="Daily help" subtitle="Maids, cooks, drivers and others who come regularly" onBack={() => router.back()} />
      <FlatSwitcher />
      {state === 'no_flat' ? (
        <NoFlatState message={flatError} onRetry={reload} />
      ) : state === 'error' ? (
        <ErrorState message={error ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : (
        <>
          {error ? <Banner text={error} /> : null}
          <Button title="Add daily help" icon="person-add" onPress={() => router.push('/(resident)/daily-help/new')} />
          {helpers.length ? (
            helpers.map((h) => {
              const today = rowsOnDay(h.helper_attendance, now);
              const inside = insideNow(h.helper_attendance);
              const lastToday = [...today].sort((a, b) => b.entry_at.localeCompare(a.entry_at))[0];
              const { daysPresent } = attendanceSummary(h.helper_attendance, month);
              return (
                <Card
                  key={h.id}
                  onPress={() => router.push({ pathname: '/(resident)/daily-help/[id]', params: { id: h.id } })}
                  accessibilityLabel={`${h.name}, ${helperTypeLabel(h.type)}`}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <HelperAvatar photoPath={h.photo_path} type={h.type} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[type.heading, { color: colors.text }]}>{h.name}</Text>
                      <Text style={[type.caption, { color: colors.textMuted }]}>
                        {helperTypeLabel(h.type)} · {daysPresent} day{daysPresent === 1 ? '' : 's'} this month
                      </Text>
                    </View>
                    {!h.active ? (
                      <Pill label="Blocked" tone="danger" icon="ban" />
                    ) : inside ? (
                      <Pill label="Inside now" tone="success" icon="enter" />
                    ) : lastToday?.exit_at ? (
                      <Pill label={`Left ${formatTime(lastToday.exit_at)}`} tone="neutral" icon="exit" />
                    ) : null}
                  </View>
                </Card>
              );
            })
          ) : (
            <EmptyState
              icon="people-outline"
              title="No daily help added"
              message="Add your maid, cook or driver. They get a 6-digit code to show at the gate."
            />
          )}
        </>
      )}
    </Screen>
  );
}
