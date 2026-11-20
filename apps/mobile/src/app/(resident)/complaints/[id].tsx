import type { Database } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import { IconBadge, InfoRow, Loading, SectionTitle, useFocusLoad } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { actorLabel, commentAuthor } from '@/lib/attribution';
import { friendlyError } from '@/lib/errors';
import { formatDateTime, timeAgo } from '@/lib/format';
import { useResidentFlat } from '@/lib/residentFlat';
import { complaintCategory, complaintStatus } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { useSignedUrl } from '@/lib/useSignedUrl';
import { Avatar, Banner, Button, Card, EmptyState, Header, Input, Pill, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

type Complaint = Database['public']['Tables']['complaints']['Row'];
type Comment = Database['public']['Tables']['complaint_comments']['Row'];

export default function ComplaintScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flat, userId } = useResidentFlat();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState<string | null>(null);
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
  }, [id]);
  const { loaded, refreshing, onRefresh } = useFocusLoad(load);
  const photoUrl = useSignedUrl('complaint-photos', complaint?.photo_path);

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
        p_actor_name: (await getActorName()) ?? undefined,
      });
      if (err || !data) return setSendError(friendlyError(err?.message ?? ''));
      setComments((cur) => [...cur, data]);
      setReply('');
    } finally {
      setSending(false);
      inFlight.current = false;
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)/complaints'));

  if (!loaded) {
    return (
      <Screen edges={['top']}>
        <Header title="Complaint" onBack={back} />
        <Loading />
      </Screen>
    );
  }
  if (!complaint) {
    return (
      <Screen edges={['top']}>
        <Header title="Complaint" onBack={back} />
        {error ? (
          <Banner text={error} />
        ) : (
          <EmptyState icon="construct-outline" title="Complaint not found" message="It may belong to another flat." />
        )}
      </Screen>
    );
  }

  const category = complaintCategory(complaint.category);
  const status = complaintStatus(complaint.status);
  const flatLabel = flat?.label ?? null;

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header title={`${category.label} complaint`} subtitle={timeAgo(complaint.created_at)} onBack={back} />
      {error ? <Banner text={error} /> : null}

      <Card style={{ gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconBadge icon={category.icon} tone={status.tone} size={52} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[type.heading, { color: colors.text }]}>{category.label}</Text>
            <Pill label={status.label} tone={status.tone} icon={status.icon} />
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
          <InfoRow icon="person-outline" label="Raised by" value={actorLabel(complaint.created_by_name, flatLabel)} />
          <InfoRow icon="calendar-outline" label="Raised on" value={formatDateTime(complaint.created_at)} />
          {complaint.updated_at !== complaint.created_at ? (
            <InfoRow icon="refresh-outline" label="Last update" value={formatDateTime(complaint.updated_at)} />
          ) : null}
        </View>
      </Card>

      <SectionTitle title="Conversation" count={comments.length || undefined} />
      {comments.length ? (
        comments.map((c) => <CommentBubble key={c.id} comment={c} userId={userId} flatLabel={flatLabel} />)
      ) : (
        <Text style={[type.body, { color: colors.textMuted, textAlign: 'center', paddingVertical: space.md }]}>
          No replies yet. The society office will update you here.
        </Text>
      )}

      <Card>
        <Input
          placeholder={complaint.status === 'resolved' ? 'Still a problem? Reply here' : 'Write a reply'}
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

function CommentBubble({ comment, userId, flatLabel }: { comment: Comment; userId: string | null; flatLabel: string | null }) {
  const { colors } = useTheme();
  const author = commentAuthor(comment, userId, flatLabel);
  return (
    <View style={{ flexDirection: author.mine ? 'row-reverse' : 'row', gap: space.sm, alignItems: 'flex-end' }}>
      <Avatar name={author.mine ? (comment.author_name ?? 'Flat') : author.name} size={34} />
      <View
        style={{
          maxWidth: '80%',
          padding: space.md,
          gap: 4,
          borderRadius: radius.md,
          borderBottomRightRadius: author.mine ? 4 : radius.md,
          borderBottomLeftRadius: author.mine ? radius.md : 4,
          backgroundColor: author.mine ? colors.primarySoft : colors.surface,
          borderWidth: author.mine ? 0 : 1,
          borderColor: colors.border,
        }}>
        <Text style={[type.caption, { color: author.mine ? colors.primary : colors.warning, fontWeight: '700' }]}>
          {author.name}
        </Text>
        <Text style={[type.body, { color: colors.text }]} selectable>
          {comment.body}
        </Text>
        <Text style={[type.caption, { color: colors.textSubtle }]}>{timeAgo(comment.created_at)}</Text>
      </View>
    </View>
  );
}
