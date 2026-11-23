import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Chips, ErrorState, IconBadge, Loading, useFocusLoad } from '@/components/resident';
import { useAdminSociety } from '@/lib/adminSociety';
import { actorLabel } from '@/lib/attribution';
import { reportError } from '@/lib/errors';
import { flatLabels, loadFlatDirectory } from '@/lib/flatDirectory';
import { timeAgo } from '@/lib/format';
import { screenState } from '@/lib/screenState';
import { complaintCategory, complaintStatus } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Complaint = Database['public']['Tables']['complaints']['Row'];
type Status = Database['public']['Enums']['complaint_status'];
type Filter = 'all' | Status;

/** Newest complaints shown in the app; older ones are on the admin website. */
const LIST_LIMIT = 300;

export default function AdminComplaintsScreen() {
  const router = useRouter();
  const { societyId, societyName, error: societyError } = useAdminSociety();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<Filter>('open');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!societyId) return;
    const [c, flats] = await Promise.all([
      supabase
        .from('complaints')
        .select('*')
        .eq('society_id', societyId)
        .order('created_at', { ascending: false })
        .limit(LIST_LIMIT),
      loadFlatDirectory(societyId),
    ]);
    const err = c.error ?? flats.error;
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setComplaints(c.data ?? []);
    setLabels(flatLabels(flats.data));
  }, [societyId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!societyId);
  const state = screenState({ loaded, error: error ?? loadFailure });

  const count = (s: Status) => complaints.filter((c) => c.status === s).length;
  const shown = filter === 'all' ? complaints : complaints.filter((c) => c.status === filter);
  const options: { value: Filter; label: string }[] = [
    { value: 'open', label: `Open · ${count('open')}` },
    { value: 'in_progress', label: `In progress · ${count('in_progress')}` },
    { value: 'resolved', label: `Resolved · ${count('resolved')}` },
    { value: 'all', label: 'All' },
  ];

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline={societyName ?? 'Admin'} title="Complaints" subtitle="Update residents as work progresses" />
      {societyError ? <Banner text={societyError} /> : null}
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        societyError ? null : <Loading />
      ) : (
        <>
          <Chips options={options} value={filter} onChange={setFilter} />
          {shown.length ? (
            shown.map((c) => (
              <ComplaintCard
                key={c.id}
                complaint={c}
                flat={labels.get(c.flat_id) ?? null}
                onPress={() => router.push({ pathname: '/(admin)/complaints/[id]', params: { id: c.id } })}
              />
            ))
          ) : (
            <EmptyState
              icon={filter === 'all' ? 'construct-outline' : 'checkmark-done-outline'}
              tone={filter === 'all' ? 'brand' : 'success'}
              title={filter === 'all' ? 'No complaints yet' : `Nothing ${complaintStatus(filter).label.toLowerCase()}`}
              message={filter === 'open' ? 'All caught up — new complaints will show up here.' : undefined}
            />
          )}
        </>
      )}
    </Screen>
  );
}

function ComplaintCard({ complaint, flat, onPress }: { complaint: Complaint; flat: string | null; onPress: () => void }) {
  const { colors } = useTheme();
  const category = complaintCategory(complaint.category);
  const status = complaintStatus(complaint.status);
  return (
    <Card onPress={onPress} accessibilityLabel={`${category.label} complaint from ${flat ?? 'a flat'}, ${status.label}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconBadge icon={category.icon} tone={status.tone} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]}>
            {category.label}
            {flat ? <Text style={{ color: colors.primary }}>{`  ·  ${flat}`}</Text> : null}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {actorLabel(complaint.created_by_name, flat)} · {timeAgo(complaint.created_at)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </View>
      <Text style={[type.body, { color: colors.textMuted }]} numberOfLines={2}>
        {complaint.description}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Pill label={status.label} tone={status.tone} icon={status.icon} />
        {complaint.photo_path ? <Pill label="Photo" tone="info" icon="image" /> : null}
      </View>
    </Card>
  );
}
