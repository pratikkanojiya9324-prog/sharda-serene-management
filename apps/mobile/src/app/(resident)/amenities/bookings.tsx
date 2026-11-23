import { BOOKING_SELECT } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { bookingPill, slotLabel } from '@/lib/community';
import { reportError } from '@/lib/errors';
import { formatIst } from '@/lib/ist';
import { useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Booking = {
  id: string;
  start_at: string;
  end_at: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled';
  booked_by_name: string | null;
  reject_reason: string | null;
  amenities: { name: string } | null;
};

export default function MyBookingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('amenity_bookings')
      .select(BOOKING_SELECT)
      .eq('flat_id', flatId)
      .order('start_at', { ascending: false })
      .limit(100);
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setBookings((data ?? []) as unknown as Booking[]);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading: loading, hasFlat: !!flat });

  function confirmCancel(b: Booking) {
    if (inFlight.current) return;
    Alert.alert('Cancel this booking?', `${b.amenities?.name ?? 'Booking'} · ${formatIst(b.start_at)}`, [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel booking', style: 'destructive', onPress: () => cancel(b.id) },
    ]);
  }

  async function cancel(bookingId: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyId(bookingId);
    setActionError(null);
    try {
      const { error: err } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId });
      if (err) setActionError(reportError(err));
      await load();
    } finally {
      setBusyId(null);
      inFlight.current = false;
    }
  }

  if (state === 'no_flat') {
    return (
      <Screen>
        <NoFlatState message={flatError} onRetry={reload} />
      </Screen>
    );
  }

  const now = Date.now();
  const isUpcoming = (b: Booking) => new Date(b.end_at).getTime() > now;
  const upcoming = bookings.filter(isUpcoming).sort((a, b) => a.start_at.localeCompare(b.start_at));
  const past = bookings.filter((b) => !isUpcoming(b));
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)/amenities'));

  const row = (b: Booking, canCancel: boolean) => {
    const pill = bookingPill(b.status);
    return (
      <Card key={b.id}>
        <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <IconBadge icon="calendar" tone={pill.tone} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.heading, { color: colors.text }]}>{b.amenities?.name ?? 'Amenity'}</Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>
              {formatIst(b.start_at)} · {slotLabel(b.start_at, b.end_at)}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          <Pill label={pill.label} tone={pill.tone} />
        </View>
        {b.status === 'rejected' && b.reject_reason ? (
          <Text style={[type.caption, { color: colors.textMuted }]}>Reason: {b.reject_reason}</Text>
        ) : null}
        {canCancel && (b.status === 'pending' || b.status === 'confirmed') ? (
          <Button
            title="Cancel booking"
            variant="secondary"
            icon="close"
            loading={busyId === b.id}
            disabled={busyId !== null}
            onPress={() => confirmCancel(b)}
          />
        ) : null}
      </Card>
    );
  };

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline="Society" title="My bookings" onBack={back} />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {actionError ? <Banner text={actionError} /> : null}
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : bookings.length ? (
        <>
          {upcoming.length ? (
            <>
              <SectionTitle title="Upcoming" />
              {upcoming.map((b) => row(b, true))}
            </>
          ) : null}
          {past.length ? (
            <>
              <SectionTitle title="Past" />
              {past.map((b) => row(b, false))}
            </>
          ) : null}
        </>
      ) : (
        <EmptyState icon="calendar-outline" title="No bookings yet" message="Book a hall or court from the Book amenity screen." />
      )}
    </Screen>
  );
}
