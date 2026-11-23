import Ionicons from '@expo/vector-icons/Ionicons';
import { AMENITY_SELECT } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { reportError } from '@/lib/errors';
import { slotLengthText, timeText } from '@/lib/community';
import { useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type AmenityRow = {
  id: string;
  name: string;
  description: string | null;
  open_time: string;
  close_time: string;
  slot_minutes: number;
  requires_approval: boolean;
  fee_note: string | null;
};

export default function AmenitiesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const [items, setItems] = useState<AmenityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('amenities')
      .select(AMENITY_SELECT)
      .eq('active', true)
      .order('name');
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setItems(data ?? []);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading: loading, hasFlat: !!flat });

  if (state === 'no_flat') {
    return (
      <Screen>
        <NoFlatState message={flatError} onRetry={reload} />
      </Screen>
    );
  }
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)'));

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        overline="Society"
        title="Book amenity"
        onBack={back}
        right={
          <Pressable onPress={() => router.push('/(resident)/amenities/bookings')} hitSlop={8} accessibilityRole="button">
            <Text style={[type.label, { color: colors.primary }]}>My bookings</Text>
          </Pressable>
        }
      />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : items.length ? (
        items.map((a) => (
          <Card
            key={a.id}
            onPress={() => router.push({ pathname: '/(resident)/amenities/[id]', params: { id: a.id } })}
            accessibilityLabel={`${a.name}, ${timeText(a.open_time)} to ${timeText(a.close_time)}`}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <IconBadge icon="calendar" tone="brand" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.heading, { color: colors.text }]}>{a.name}</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  {timeText(a.open_time)} – {timeText(a.close_time)} · {slotLengthText(a.slot_minutes)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {a.requires_approval ? <Pill label="Needs approval" tone="warning" icon="hourglass-outline" /> : null}
              {a.fee_note ? <Pill label={a.fee_note} tone="info" icon="cash-outline" /> : null}
            </View>
          </Card>
        ))
      ) : (
        <EmptyState
          icon="calendar-outline"
          title="Nothing to book yet"
          message="When the office adds a hall or court, it will show up here."
        />
      )}
    </Screen>
  );
}
