import { PARCEL_SELECT } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { reportError } from '@/lib/errors';
import { formatDateTime, timeAgo } from '@/lib/format';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { parcelStatus } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { useSignedUrl } from '@/lib/useSignedUrl';
import { Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

type Parcel = {
  id: string;
  created_at: string;
  courier: string;
  note: string | null;
  photo_path: string | null;
  status: 'at_gate' | 'collected' | 'returned';
  collected_at: string | null;
  collected_by_name: string | null;
};

export default function ParcelsScreen() {
  const router = useRouter();
  const { flat, loading: flatLoading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('parcels')
      .select(PARCEL_SELECT)
      .eq('flat_id', flatId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (err) {
      setLocalError(reportError(err));
      return false;
    }
    setLocalError(null);
    setParcels((data ?? []) as unknown as Parcel[]);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: hookError } = useFocusLoad(load, !!flatId);
  const error = localError ?? hookError;
  const state = screenState({ loaded, error, needsFlat: true, flatLoading, hasFlat: !!flat });

  const atGate = parcels.filter((p) => p.status === 'at_gate');
  const done = parcels.filter((p) => p.status !== 'at_gate');

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Header title="Parcels" subtitle="Parcels the guard is holding for you" onBack={() => router.back()} />
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
          <SectionTitle title="At gate" count={atGate.length || undefined} />
          {atGate.length ? (
            atGate.map((p) => <ParcelCard key={p.id} parcel={p} />)
          ) : (
            <EmptyState icon="cube-outline" title="Nothing at the gate" message="You get a notification when a parcel arrives." />
          )}
          {done.length ? (
            <>
              <SectionTitle title="Collected" count={done.length} />
              {done.map((p) => (
                <ParcelCard key={p.id} parcel={p} />
              ))}
            </>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function ParcelCard({ parcel }: { parcel: Parcel }) {
  const { colors } = useTheme();
  const url = useSignedUrl('parcel-photos', parcel.photo_path);
  const info = parcelStatus(parcel.status);
  let detail = `Arrived ${timeAgo(parcel.created_at)}`;
  if (parcel.status === 'collected' && parcel.collected_at) {
    detail = `Collected${parcel.collected_by_name ? ` by ${parcel.collected_by_name}` : ''} · ${formatDateTime(parcel.collected_at)}`;
  } else if (parcel.status === 'returned') {
    detail = `Sent back${parcel.collected_at ? ` · ${formatDateTime(parcel.collected_at)}` : ''}`;
  }
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        {url ? (
          <Image source={{ uri: url }} style={{ width: 56, height: 56, borderRadius: radius.md }} resizeMode="cover" />
        ) : (
          <IconBadge icon="cube" tone="accent" size={56} />
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]}>{parcel.courier}</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>{detail}</Text>
          {parcel.note ? <Text style={[type.caption, { color: colors.textMuted }]}>{parcel.note}</Text> : null}
        </View>
        <Pill label={info.label} tone={info.tone} icon={info.icon} />
      </View>
    </Card>
  );
}
