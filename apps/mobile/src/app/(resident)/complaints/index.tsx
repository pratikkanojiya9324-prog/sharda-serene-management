import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Chips, ErrorState, IconBadge, Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { actorLabel } from '@/lib/attribution';
import { reportError } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { complaintCategory, complaintStatus } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Complaint = Database['public']['Tables']['complaints']['Row'];
type Filter = 'all' | Complaint['status'];

export default function ComplaintsScreen() {
  const router = useRouter();
  const { flat, loading: flatLoading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('complaints')
      .select('*')
      .eq('flat_id', flatId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setComplaints(data ?? []);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading, hasFlat: !!flat });
  const count = (s: Complaint['status']) => complaints.filter((c) => c.status === s).length;
  const shown = filter === 'all' ? complaints : complaints.filter((c) => c.status === filter);
  const raise = () => router.push('/(resident)/complaints/new');

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline={flat?.label} title="Complaints" subtitle="Raise an issue and follow its progress" />
      <FlatSwitcher />
      <Button title="Raise a complaint" icon="add-circle" onPress={raise} disabled={!flat} />
      {error && state === 'ready' ? <Banner text={error} /> : null}
      {state === 'no_flat' ? (
        <NoFlatState message={flatError} onRetry={reload} />
      ) : state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : complaints.length ? (
        <>
          <Chips<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: `All ${complaints.length}` },
              { value: 'open', label: `Open ${count('open')}` },
              { value: 'in_progress', label: `In progress ${count('in_progress')}` },
              { value: 'resolved', label: `Resolved ${count('resolved')}` },
            ]}
          />
          {shown.length ? (
            shown.map((c) => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                flatLabel={flat?.label ?? null}
                onPress={() => router.push({ pathname: '/(resident)/complaints/[id]', params: { id: c.id } })}
              />
            ))
          ) : (
            <EmptyState icon="filter-outline" tone="neutral" title="Nothing here" message="No complaints with this status." />
          )}
        </>
      ) : (
        <EmptyState
          icon="construct-outline"
          title="No complaints"
          message="Something broken or not right? Let the society office know."
        />
      )}
    </Screen>
  );
}

function ComplaintCard({
  complaint,
  flatLabel,
  onPress,
}: {
  complaint: Complaint;
  flatLabel: string | null;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const category = complaintCategory(complaint.category);
  const status = complaintStatus(complaint.status);
  return (
    <Card onPress={onPress} accessibilityLabel={`${category.label} complaint, ${status.label}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconBadge icon={category.icon} tone={status.tone} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]}>{category.label}</Text>
          <Text style={[type.caption, { color: colors.textSubtle }]}>{timeAgo(complaint.created_at)}</Text>
        </View>
        <Pill label={status.label} tone={status.tone} icon={status.icon} />
      </View>
      <Text style={[type.body, { color: colors.textMuted }]} numberOfLines={2}>
        {complaint.description}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="person-circle-outline" size={16} color={colors.textSubtle} />
        <Text style={[type.caption, { color: colors.textSubtle, flex: 1 }]} numberOfLines={1}>
          Raised by {actorLabel(complaint.created_by_name, flatLabel)}
        </Text>
        {complaint.photo_path ? <Ionicons name="image-outline" size={16} color={colors.textSubtle} /> : null}
      </View>
    </Card>
  );
}
