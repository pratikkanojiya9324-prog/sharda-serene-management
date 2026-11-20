import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, Text, View } from 'react-native';

import { IconBadge, Loading, SectionTitle, useFocusLoad } from '@/components/resident';
import { useAdminSociety } from '@/lib/adminSociety';
import { friendlyError } from '@/lib/errors';
import { timeAgo } from '@/lib/format';
import { sortNotices } from '@/lib/notices';
import { supabase } from '@/lib/supabase';
import { Banner, Card, EmptyState, Header, Pill, Screen, type IconName } from '@/theme/components';
import { radius, shadow, space, type, useTheme } from '@/theme/tokens';

type Notice = Database['public']['Tables']['notices']['Row'];

export default function AdminNoticesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { societyId, societyName, error: societyError } = useAdminSociety();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!societyId) return;
    const { data, error: err } = await supabase
      .from('notices')
      .select('*')
      .eq('society_id', societyId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) setError(friendlyError(err.message));
    else {
      setError(null);
      setNotices(sortNotices(data ?? []));
    }
  }, [societyId]);
  const { loaded, refreshing, onRefresh } = useFocusLoad(load, !!societyId);

  async function togglePin(n: Notice) {
    if (busyId) return;
    setBusyId(n.id);
    const { data, error: err } = await supabase.rpc('set_notice_pinned', { p_id: n.id, p_pinned: !n.pinned });
    setBusyId(null);
    if (err || !data) return setError(friendlyError(err?.message ?? ''));
    setError(null);
    setNotices((cur) => sortNotices(cur.map((x) => (x.id === data.id ? data : x))));
  }

  function confirmDelete(n: Notice) {
    Alert.alert('Delete this notice?', `"${n.title}" will be removed for every resident.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove(n) },
    ]);
  }

  async function remove(n: Notice) {
    if (busyId) return;
    setBusyId(n.id);
    const { error: err } = await supabase.rpc('delete_notice', { p_id: n.id });
    setBusyId(null);
    if (err) return setError(friendlyError(err.message));
    setError(null);
    setNotices((cur) => cur.filter((x) => x.id !== n.id));
  }

  async function openAttachment(n: Notice) {
    if (!n.attachment_path) return;
    const { data, error: err } = await supabase.storage.from('notices').createSignedUrl(n.attachment_path, 3600);
    if (err || !data?.signedUrl) return setError('Could not open the attachment, try again');
    Linking.openURL(data.signedUrl).catch(() => setError('No app on this phone can open this file'));
  }

  const pinned = notices.filter((n) => n.pinned).length;

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        overline={societyName ?? 'Admin'}
        title="Notices"
        subtitle="Announcements for every resident"
        right={
          <Pressable
            onPress={() => router.push('/(admin)/notices/new')}
            accessibilityRole="button"
            accessibilityLabel="New notice"
            disabled={!societyId}
            style={({ pressed }) => [
              {
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                opacity: societyId ? 1 : 0.5,
              },
              shadow(1),
            ]}>
            <Ionicons name="add" size={28} color={colors.onPrimary} />
          </Pressable>
        }
      />
      {societyError ? <Banner text={societyError} /> : null}
      {error ? <Banner text={error} /> : null}
      {!loaded ? (
        societyError ? null : <Loading />
      ) : notices.length ? (
        <>
          <SectionTitle title={`${notices.length} notice${notices.length > 1 ? 's' : ''}`} right={pinned ? <Pill label={`${pinned} pinned`} tone="accent" icon="pin" /> : null} />
          {notices.map((n) => (
            <AdminNoticeCard
              key={n.id}
              notice={n}
              busy={busyId === n.id}
              onPin={() => togglePin(n)}
              onDelete={() => confirmDelete(n)}
              onOpen={() => openAttachment(n)}
            />
          ))}
        </>
      ) : (
        <EmptyState
          icon="megaphone-outline"
          title="No notices yet"
          message="Post the first announcement for your residents."
        />
      )}
    </Screen>
  );
}

function AdminNoticeCard({
  notice,
  busy,
  onPin,
  onDelete,
  onOpen,
}: {
  notice: Notice;
  busy: boolean;
  onPin: () => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card style={notice.pinned ? { borderColor: colors.accent, borderWidth: 1 } : undefined}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <IconBadge icon={notice.pinned ? 'pin' : 'megaphone'} tone={notice.pinned ? 'accent' : 'brand'} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.heading, { color: colors.text }]} numberOfLines={2}>
            {notice.title}
          </Text>
          <Text style={[type.caption, { color: colors.textSubtle }]}>{timeAgo(notice.created_at)}</Text>
        </View>
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
      <Text style={[type.body, { color: colors.textMuted }]} numberOfLines={4}>
        {notice.body}
      </Text>
      <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
        <Action
          icon={notice.pinned ? 'pin' : 'pin-outline'}
          label={notice.pinned ? 'Unpin' : 'Pin'}
          onPress={onPin}
          disabled={busy}
          active={notice.pinned}
        />
        {notice.attachment_kind ? (
          <Action
            icon={notice.attachment_kind === 'pdf' ? 'document-text-outline' : 'image-outline'}
            label={notice.attachment_kind === 'pdf' ? 'Open PDF' : 'Open photo'}
            onPress={onOpen}
          />
        ) : null}
        <View style={{ flex: 1 }} />
        <Action icon="trash-outline" label="Delete" onPress={onDelete} disabled={busy} danger />
      </View>
    </Card>
  );
}

function Action({
  icon,
  label,
  onPress,
  disabled = false,
  active = false,
  danger = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const fg = danger ? colors.danger : active ? colors.warning : colors.primary;
  const bg = danger ? colors.dangerSoft : active ? colors.accentSoft : colors.primarySoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        paddingHorizontal: space.md,
        borderRadius: radius.pill,
        backgroundColor: bg,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}>
      <Ionicons name={icon} size={16} color={fg} />
      <Text style={[type.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}
