import { AMENITY_SELECT, BOOKING_DAYS_AHEAD } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { dateChips, slotLabel, slotLengthText, timeText } from '@/lib/community';
import { reportError } from '@/lib/errors';
import { formatIst } from '@/lib/ist';
import { useResidentFlat } from '@/lib/residentFlat';
import { supabase } from '@/lib/supabase';
import { Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

type Amenity = {
  id: string;
  name: string;
  description: string | null;
  open_time: string;
  close_time: string;
  slot_minutes: number;
  requires_approval: boolean;
  fee_note: string | null;
  max_upcoming: number;
};
type Slot = { start_at: string; end_at: string; state: string };

export default function AmenityScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const chips = useMemo(() => dateChips(new Date(), BOOKING_DAYS_AHEAD + 1), []);
  const [date, setDate] = useState(chips[0].date);
  const [amenity, setAmenity] = useState<Amenity | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const dateRef = useRef(date);
  dateRef.current = date;

  const load = useCallback(async () => {
    if (!flatId) return;
    const a = await supabase.from('amenities').select(AMENITY_SELECT).eq('id', id).maybeSingle();
    if (a.error) {
      setError(reportError(a.error));
      return false;
    }
    if (!a.data || !a.data.active) {
      setMissing(true);
      setError(null);
      return;
    }
    const s = await supabase.rpc('amenity_slots', { p_amenity_id: id, p_date: date, p_flat_id: flatId });
    // The date chip changed while this was loading: a newer load owns the grid.
    if (dateRef.current !== date) return;
    if (s.error) {
      setError(reportError(s.error));
      return false;
    }
    setError(null);
    setMissing(false);
    setAmenity(a.data);
    setSlots(s.data ?? []);
  }, [id, flatId, date]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)/amenities'));

  function pickDate(d: string) {
    setDate(d);
    setBookError(null);
    setSuccess(null);
  }

  function confirmBook(slot: Slot) {
    if (!amenity || busy) return;
    const when = `${formatIst(slot.start_at)} (${slotLabel(slot.start_at, slot.end_at, amenity.slot_minutes)})`;
    Alert.alert(
      `Book ${amenity.name}?`,
      amenity.requires_approval ? `${when}\n\nThe office will approve this request.` : when,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Book', onPress: () => book(slot) },
      ],
    );
  }

  async function book(slot: Slot) {
    if (!amenity || !flatId || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setBookError(null);
    setSuccess(null);
    try {
      const actor = await getActorName();
      const { error: err } = await supabase.rpc('book_amenity', {
        p_amenity_id: amenity.id,
        p_flat_id: flatId,
        p_start_at: slot.start_at,
        ...(actor ? { p_actor_name: actor } : {}),
      });
      if (err) {
        setBookError(reportError(err));
        // Someone else got it, or the situation changed: show the current slots.
        await load();
        return;
      }
      setSuccess(amenity.requires_approval ? 'Request sent. You will be told when the office decides.' : 'Booked!');
      await load();
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  if (!flat && !loading) {
    return (
      <Screen>
        <NoFlatState message={flatError} onRetry={reload} />
      </Screen>
    );
  }

  const visible = slots.filter((s) => s.state !== 'past');

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header title={amenity?.name ?? 'Amenity'} onBack={back} />
      {error && loaded ? <Banner text={error} /> : null}
      {!loaded ? (
        loadFailure || error ? <Banner text={(error ?? loadFailure) as string} /> : <Loading />
      ) : missing || !amenity ? (
        <EmptyState icon="calendar-outline" title="Not available" message="This is not open for booking right now." />
      ) : (
        <>
          <Card style={{ gap: space.sm }}>
            {amenity.description ? <Text style={[type.body, { color: colors.text }]}>{amenity.description}</Text> : null}
            <Text style={[type.caption, { color: colors.textMuted }]}>
              {timeText(amenity.open_time)} – {timeText(amenity.close_time)} · {slotLengthText(amenity.slot_minutes)} · up to{' '}
              {amenity.max_upcoming} upcoming
            </Text>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
              {amenity.requires_approval ? <Pill label="Needs approval" tone="warning" icon="hourglass-outline" /> : null}
              {amenity.fee_note ? <Pill label={amenity.fee_note} tone="info" icon="cash-outline" /> : null}
            </View>
          </Card>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {chips.map((c) => {
              const active = c.date === date;
              return (
                <Pressable
                  key={c.date}
                  onPress={() => pickDate(c.date)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{
                    paddingHorizontal: space.lg,
                    paddingVertical: space.sm,
                    borderRadius: radius.pill,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                    backgroundColor: active ? colors.primary : colors.surface,
                  }}>
                  <Text style={[type.label, { color: active ? colors.onPrimary : colors.text }]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {bookError ? <Banner text={bookError} /> : null}
          {success ? <Banner text={success} tone="success" icon="checkmark-circle" /> : null}

          {visible.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {visible.map((s) => (
                <SlotButton
                  key={s.start_at}
                  label={slotLabel(s.start_at, s.end_at, amenity.slot_minutes)}
                  state={s.state}
                  onPress={() => confirmBook(s)}
                />
              ))}
            </View>
          ) : (
            <EmptyState icon="time-outline" title="No slots left" message="Pick another day." />
          )}
          <Text style={[type.caption, { color: colors.textSubtle }]}>
            Grey slots are taken. Teal slots are your flat&apos;s bookings.
          </Text>
        </>
      )}
    </Screen>
  );
}

function SlotButton({ label, state, onPress }: { label: string; state: string; onPress: () => void }) {
  const { colors } = useTheme();
  const free = state === 'free';
  const mine = state === 'mine';
  return (
    <Pressable
      onPress={free ? onPress : undefined}
      disabled={!free}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${free ? 'free' : mine ? 'booked by your flat' : 'taken'}`}
      accessibilityState={{ disabled: !free }}
      style={({ pressed }) => ({
        minWidth: '30%',
        flexGrow: 1,
        alignItems: 'center',
        paddingVertical: space.md,
        paddingHorizontal: space.sm,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: mine || free ? colors.primary : colors.border,
        backgroundColor: mine ? colors.primary : pressed ? colors.primarySoft : free ? colors.surface : colors.surfaceMuted,
      })}>
      <Text
        style={[
          type.label,
          { color: mine ? colors.onPrimary : free ? colors.primary : colors.textSubtle, textAlign: 'center' },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}
