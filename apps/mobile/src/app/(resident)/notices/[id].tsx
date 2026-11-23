import type { Database } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Linking, Pressable, Text, View } from 'react-native';

import { IconBadge, Loading, useFocusLoad } from '@/components/resident';
import { friendlyError } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { useSignedUrl } from '@/lib/useSignedUrl';
import { Banner, Button, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

type Notice = Database['public']['Tables']['notices']['Row'];

export default function NoticeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('notices').select('*').eq('id', id).maybeSingle();
    if (err) setError(friendlyError(err.message));
    else {
      setError(null);
      setNotice(data);
      setMissing(!data);
    }
  }, [id]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)/notices'));

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header title="Notice" onBack={back} />
      {error ? <Banner text={error} /> : null}
      {!loaded ? (
        loadFailure ? <Banner text={loadFailure} /> : <Loading />
      ) : missing || !notice ? (
        <EmptyState icon="megaphone-outline" title="Notice not found" message="It may have been removed by the office." />
      ) : (
        <Card style={{ gap: space.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconBadge icon={notice.pinned ? 'pin' : 'megaphone'} tone={notice.pinned ? 'accent' : 'brand'} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.caption, { color: colors.textSubtle }]}>{formatDateTime(notice.created_at)}</Text>
              {notice.pinned ? <Pill label="Pinned" tone="accent" icon="pin" /> : null}
            </View>
          </View>
          <Text style={[type.title, { color: colors.text }]} selectable>
            {notice.title}
          </Text>
          <Text style={[type.body, { color: colors.text, lineHeight: 24 }]} selectable>
            {notice.body}
          </Text>
          {notice.attachment_path && notice.attachment_kind === 'image' ? (
            <NoticeImage path={notice.attachment_path} />
          ) : null}
          {notice.attachment_path && notice.attachment_kind === 'pdf' ? <NoticePdf path={notice.attachment_path} /> : null}
        </Card>
      )}
    </Screen>
  );
}

function NoticeImage({ path }: { path: string }) {
  const { colors } = useTheme();
  const url = useSignedUrl('notices', path);
  const [ratio, setRatio] = useState(4 / 3);
  if (!url) return <View style={{ aspectRatio: ratio, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }} />;
  return (
    <Pressable onPress={() => Linking.openURL(url)} accessibilityRole="imagebutton" accessibilityLabel="Open the photo">
      <Image
        source={{ uri: url }}
        onLoad={(e) => {
          const { width, height } = e.nativeEvent.source;
          if (width && height) setRatio(width / height);
        }}
        style={{ width: '100%', aspectRatio: ratio, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
        resizeMode="contain"
      />
    </Pressable>
  );
}

/** PDFs open in the phone's viewer through a fresh signed URL. */
function NoticePdf({ path }: { path: string }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.storage.from('notices').createSignedUrl(path, 3600);
      if (err || !data?.signedUrl) return setError('Could not open the PDF, try again');
      try {
        await Linking.openURL(data.signedUrl);
      } catch {
        setError('No app on this phone can open PDFs');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          padding: space.md,
          borderRadius: radius.md,
          backgroundColor: colors.surfaceMuted,
        }}>
        <IconBadge icon="document-text" tone="danger" />
        <View style={{ flex: 1 }}>
          <Text style={[type.label, { color: colors.text }]}>Attached document</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>PDF · opens in your PDF viewer</Text>
        </View>
      </View>
      <Button title="Open PDF" icon="open-outline" variant="secondary" loading={busy} onPress={open} />
      {error ? <Banner text={error} /> : null}
    </View>
  );
}
