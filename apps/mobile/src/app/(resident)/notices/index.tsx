import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, useFocusLoad } from '@/components/resident';
import { reportError } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { sortNotices } from '@/lib/notices';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Notice = Database['public']['Tables']['notices']['Row'];

export default function NoticesScreen() {
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState<string | null>(null);

  // RLS limits notices to the user's society.
  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('notices')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setNotices(sortNotices(data ?? []));
  }, []);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load);
  const state = screenState({ loaded, error: error ?? loadFailure });

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline="Society" title="Notices" subtitle="Announcements from the society office" />
      {error && state === 'ready' ? <Banner text={error} /> : null}
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : notices.length ? (
        notices.map((n) => (
          <NoticeCard
            key={n.id}
            notice={n}
            onPress={() => router.push({ pathname: '/(resident)/notices/[id]', params: { id: n.id } })}
          />
        ))
      ) : (
        <EmptyState icon="megaphone-outline" title="No notices yet" message="New announcements will show up here." />
      )}
    </Screen>
  );
}

function NoticeCard({ notice, onPress }: { notice: Notice; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${notice.pinned ? 'Pinned notice: ' : ''}${notice.title}`}
      style={notice.pinned ? { borderColor: colors.accent, borderWidth: 1 } : undefined}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <IconBadge icon={notice.pinned ? 'pin' : 'megaphone'} tone={notice.pinned ? 'accent' : 'brand'} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.heading, { color: colors.text }]} numberOfLines={2}>
            {notice.title}
          </Text>
          <Text style={[type.caption, { color: colors.textSubtle }]}>{timeAgo(notice.created_at)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </View>
      <Text style={[type.body, { color: colors.textMuted }]} numberOfLines={3}>
        {notice.body}
      </Text>
      {notice.pinned || notice.attachment_kind ? (
        <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
          {notice.pinned ? <Pill label="Pinned" tone="accent" icon="pin" /> : null}
          {notice.attachment_kind === 'image' ? <Pill label="Photo" tone="info" icon="image" /> : null}
          {notice.attachment_kind === 'pdf' ? <Pill label="PDF" tone="info" icon="document-text" /> : null}
        </View>
      ) : null}
    </Card>
  );
}
