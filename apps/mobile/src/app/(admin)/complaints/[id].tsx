import Ionicons from '@expo/vector-icons/Ionicons';
import { FLAT_DIRECTORY_SELECT, type Database } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, Text, View } from 'react-native';

import { IconBadge, InfoRow, Loading, SectionTitle, useFocusLoad } from '@/components/resident';
import { useAdminSociety } from '@/lib/adminSociety';
import { actorLabel } from '@/lib/attribution';
import { friendlyError } from '@/lib/errors';
import { flatLabels } from '@/lib/flatDirectory';
import { formatDateTime, timeAgo } from '@/lib/format';
import { complaintCategory, complaintStatus } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { useSignedUrl } from '@/lib/useSignedUrl';
import { Avatar, Banner, Button, Card, EmptyState, Header, Input, Screen } from '@/theme/components';
import { radius, space, toneColors, type, useTheme } from '@/theme/tokens';

type Complaint = Database['public']['Tables']['complaints']['Row'];
type Comment = Database['public']['Tables']['complaint_comments']['Row'];
type Status = Database['public']['Enums']['complaint_status'];

const STATUSES: Status[] = ['open', 'in_progress', 'resolved'];

export default function AdminComplaintScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId, userName } = useAdminSociety();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [flat, setFlat] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  // The flat's account(s): their comments are "from the flat", anyone else's from the office.
  const [flatAccounts, setFlatAccounts] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<Status | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    const [c, cm] = await Promise.all([
      supabase.from('complaints').select('*').eq('id', id).maybeSingle(),
      supabase.from('complaint_comments').select('*').eq('complaint_id', id).order('created_at'),
    ]);
    const err = c.error ?? cm.error;
    if (err) return setError(friendlyError(err.message));
    setError(null);
    setComplaint(c.data);
    setComments(cm.data ?? []);
    if (c.data) {
      const flatId = c.data.flat_id;
      const [f, r] = await Promise.all([
        supabase.from('flats').select(FLAT_DIRECTORY_SELECT).eq('id', flatId),
        supabase.from('flat_residents').select('profile_id').eq('flat_id', flatId),
      ]);
      if (f.data) setFlat(flatLabels(f.data).get(flatId) ?? null);
      if (r.data) setFlatAccounts(new Set(r.data.map((x) => x.profile_id)));
    }
  }, [id]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load);
  const photoUrl = useSignedUrl('complaint-photos', complaint?.photo_path);

  async function changeStatus(next: Status) {
    if (!complaint || next === complaint.status || savingStatus) return;
    setSavingStatus(next);
    const { data, error: err } = await supabase.rpc('set_complaint_status', {
      p_complaint_id: complaint.id,
      p_status: next,
    });
    setSavingStatus(null);
    if (err || !data) return setError(friendlyError(err?.message ?? ''));
    setError(null);
    setComplaint(data);
  }

  async function send() {
    const body = reply.trim();
    if (!body || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setSendError(null);
    try {
      const { data, error: err } = await supabase.rpc('add_complaint_comment', {
        p_complaint_id: id,
        p_body: body,
        ...(userName ? { p_actor_name: userName.slice(0, 60) } : {}),
      });
      if (err || !data) return setSendError(friendlyError(err?.message ?? ''));
      setComments((cur) => [...cur, data]);
      setReply('');
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(admin)/complaints'));

  if (!loaded || !complaint) {
    return (
      <Screen edges={['top']}>
        <Header title="Complaint" onBack={back} />
        {!loaded ? (
          loadFailure ? <Banner text={loadFailure} /> : <Loading />
        ) : error ? (
          <Banner text={error} />
        ) : (
          <EmptyState icon="construct-outline" title="Complaint not found" message="It may have been removed." />
        )}
      </Screen>
    );
  }

  const category = complaintCategory(complaint.category);
  const status = complaintStatus(complaint.status);

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        overline={flat ?? undefined}
        title={`${category.label} complaint`}
        subtitle={timeAgo(complaint.created_at)}
        onBack={back}
      />
      {error ? <Banner text={error} /> : null}

      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconBadge icon={category.icon} tone={status.tone} size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.heading, { color: colors.text }]}>{category.label}</Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>{flat ? `Flat ${flat}` : 'Flat'}</Text>
          </View>
        </View>
        <Text style={[type.body, { color: colors.text, lineHeight: 24 }]} selectable>
          {complaint.description}
        </Text>
        {photoUrl ? (
          <Pressable onPress={() => Linking.openURL(photoUrl)} accessibilityRole="imagebutton" accessibilityLabel="Open the photo">
            <Image
              source={{ uri: photoUrl }}
              style={{ width: '100%', height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
              resizeMode="cover"
            />
          </Pressable>
        ) : complaint.photo_path ? (
          <View style={{ height: 220, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }} />
        ) : null}
        <View style={{ gap: space.sm }}>
          <InfoRow icon="person-outline" label="Raised by" value={actorLabel(complaint.created_by_name, flat)} />
          <InfoRow icon="calendar-outline" label="Raised on" value={formatDateTime(complaint.created_at)} />
          {complaint.updated_at !== complaint.created_at ? (
            <InfoRow icon="refresh-outline" label="Last update" value={formatDateTime(complaint.updated_at)} />
          ) : null}
        </View>
      </Card>

      <SectionTitle title="Status" />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {STATUSES.map((s) => (
          <StatusOption
            key={s}
            status={s}
            active={complaint.status === s}
            saving={savingStatus === s}
            disabled={!!savingStatus}
            onPress={() => changeStatus(s)}
          />
        ))}
      </View>
      <Text style={[type.caption, { color: colors.textSubtle }]}>
        Currently {status.label.toLowerCase()} · the flat is notified when you change it
      </Text>

      <SectionTitle title="Conversation" count={comments.length || undefined} />
      {comments.length ? (
        comments.map((c) => (
          <CommentBubble
            key={c.id}
            comment={c}
            mine={!!userId && c.author_id === userId}
            fromFlat={!!c.author_id && flatAccounts.has(c.author_id)}
            flat={flat}
          />
        ))
      ) : (
        <Text style={[type.body, { color: colors.textMuted, textAlign: 'center', paddingVertical: space.md }]}>
          No replies yet. Let the flat know what is happening.
        </Text>
      )}

      <Card>
        <Input
          placeholder="Reply to the flat"
          accessibilityLabel="Reply"
          value={reply}
          onChangeText={setReply}
          multiline
          maxLength={2000}
          style={{ minHeight: 60, textAlignVertical: 'top' }}
        />
        {sendError ? <Banner text={sendError} /> : null}
        <Button title="Send reply" icon="send" loading={sending} disabled={!reply.trim()} onPress={send} />
      </Card>
    </Screen>
  );
}

function StatusOption({
  status,
  active,
  saving,
  disabled,
  onPress,
}: {
  status: Status;
  active: boolean;
  saving: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const info = complaintStatus(status);
  const { fg, bg } = toneColors(colors, info.tone);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || active}
      accessibilityRole="button"
      accessibilityLabel={`Mark ${info.label.toLowerCase()}`}
      accessibilityState={{ selected: active, busy: saving }}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 76,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: radius.md,
        borderWidth: active ? 2 : 1,
        borderColor: active ? fg : colors.border,
        backgroundColor: active ? bg : pressed ? colors.surfaceMuted : colors.surface,
        opacity: disabled && !saving && !active ? 0.6 : 1,
      })}>
      {saving ? <ActivityIndicator color={fg} /> : <Ionicons name={info.icon} size={22} color={active ? fg : colors.textSubtle} />}
      <Text style={[type.label, { color: active ? fg : colors.textMuted }]}>{info.label}</Text>
    </Pressable>
  );
}

function CommentBubble({
  comment,
  mine,
  fromFlat,
  flat,
}: {
  comment: Comment;
  mine: boolean;
  fromFlat: boolean;
  flat: string | null;
}) {
  const { colors } = useTheme();
  // Flat comments carry the "who's using this phone" name; admin comments the admin's name.
  const name = comment.author_name?.trim() || null;
  const label = mine ? 'You' : fromFlat ? actorLabel(name, flat) : (name ?? 'Society office');
  return (
    <View style={{ flexDirection: mine ? 'row-reverse' : 'row', gap: space.sm, alignItems: 'flex-end' }}>
      <Avatar name={mine ? 'You' : (name ?? (fromFlat ? flat : null) ?? '?')} size={34} />
      <View
        style={{
          maxWidth: '80%',
          padding: space.md,
          gap: 4,
          borderRadius: radius.md,
          borderBottomRightRadius: mine ? 4 : radius.md,
          borderBottomLeftRadius: mine ? radius.md : 4,
          backgroundColor: mine ? colors.primarySoft : colors.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: colors.border,
        }}>
        <Text style={[type.caption, { color: mine ? colors.primary : fromFlat ? colors.warning : colors.info, fontWeight: '700' }]}>
          {label}
        </Text>
        <Text style={[type.body, { color: colors.text }]} selectable>
          {comment.body}
        </Text>
        <Text style={[type.caption, { color: colors.textSubtle }]}>{timeAgo(comment.created_at)}</Text>
      </View>
    </View>
  );
}
