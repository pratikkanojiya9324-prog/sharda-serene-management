import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Image, Pressable, Switch, Text, View } from 'react-native';

import { IconBadge } from '@/components/resident';
import { useAdminSociety } from '@/lib/adminSociety';
import { friendlyError } from '@/lib/errors';
import {
  MAX_TITLE_LENGTH,
  attachmentError,
  uploadNoticeAttachment,
  validateNotice,
  type PickedAttachment,
} from '@/lib/noticeForm';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, Header, Input, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

const sizeText = (bytes?: number) =>
  bytes === undefined ? 'PDF' : bytes < 1024 * 1024 ? `PDF · ${Math.max(1, Math.round(bytes / 1024))} KB` : `PDF · ${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function NewNoticeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { societyId, societyName } = useAdminSociety();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [file, setFile] = useState<PickedAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A fast double tap fires twice before `busy` re-renders: post only once.
  const inFlight = useRef(false);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(admin)'));

  async function pickPhoto() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return;
    const a = result.assets[0];
    const tooBig = attachmentError(a.fileSize);
    if (tooBig) return setError(tooBig);
    setFile({ kind: 'image', uri: a.uri, name: a.fileName ?? 'photo.jpg', size: a.fileSize, width: a.width });
  }

  async function pickPdf() {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled) return;
    const a = result.assets[0];
    const tooBig = attachmentError(a.size);
    if (tooBig) return setError(tooBig);
    setFile({ kind: 'pdf', uri: a.uri, name: a.name, size: a.size });
  }

  async function post() {
    if (inFlight.current) return;
    const invalid = validateNotice(title, body);
    if (invalid) return setError(invalid);
    if (!societyId) return setError('Your society is still loading, try again');
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      let attachmentPath: string | null = null;
      if (file) {
        try {
          attachmentPath = await uploadNoticeAttachment(societyId, file);
        } catch (e) {
          const msg = e instanceof Error ? e.message : '';
          return setError(msg.startsWith('Attachments') ? msg : 'The attachment could not be uploaded, try again');
        }
      }
      const { error: err } = await supabase.rpc('create_notice', {
        p_title: title.trim(),
        p_body: body.trim(),
        p_pinned: pinned,
        ...(attachmentPath && file ? { p_attachment_path: attachmentPath, p_attachment_kind: file.kind } : {}),
      });
      if (err) return setError(friendlyError(err.message));
      router.replace('/(admin)');
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <Screen scroll>
      <Header overline={societyName ?? 'Admin'} title="New notice" subtitle="Residents get a notification" onBack={back} />

      <Card style={{ gap: space.lg }}>
        <Input
          label="Title"
          placeholder="e.g. Water supply cut on Sunday"
          value={title}
          onChangeText={setTitle}
          maxLength={MAX_TITLE_LENGTH}
          icon="text-outline"
        />
        <Input
          label="Message"
          placeholder="What should residents know?"
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={5000}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconBadge icon="pin" tone="accent" size={40} />
        <View style={{ flex: 1 }}>
          <Text style={[type.heading, { color: colors.text }]}>Pin to the top</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>Pinned notices stay above the rest</Text>
        </View>
        <Switch
          value={pinned}
          onValueChange={setPinned}
          accessibilityLabel="Pin to the top"
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor="#fff"
        />
      </Card>

      <Card>
        <Text style={[type.heading, { color: colors.text }]}>Attachment</Text>
        <Text style={[type.caption, { color: colors.textMuted, marginTop: -space.sm }]}>
          Optional · one photo or PDF, up to 10 MB
        </Text>
        {file ? (
          <View style={{ gap: space.sm }}>
            {file.kind === 'image' ? (
              <Image
                source={{ uri: file.uri }}
                style={{ width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
                resizeMode="cover"
                accessibilityLabel="Attached photo"
              />
            ) : (
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
                  <Text style={[type.label, { color: colors.text }]} numberOfLines={1}>
                    {file.name}
                  </Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>{sizeText(file.size)}</Text>
                </View>
              </View>
            )}
            <Button title="Remove attachment" icon="close-circle-outline" variant="ghost" onPress={() => setFile(null)} />
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <PickTile icon="image" label="Photo" onPress={pickPhoto} />
            <PickTile icon="document-text" label="PDF" onPress={pickPdf} />
          </View>
        )}
      </Card>

      {error ? <Banner text={error} /> : null}
      <Button title="Post notice" icon="megaphone" loading={busy} onPress={post} />
    </Screen>
  );
}

function PickTile({ icon, label, onPress }: { icon: 'image' | 'document-text'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Attach a ${label === 'PDF' ? 'PDF' : 'photo'}`}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.xs,
        minHeight: 88,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.primary,
        backgroundColor: pressed ? colors.primarySoft : 'transparent',
      })}>
      <Ionicons name={icon} size={26} color={colors.primary} />
      <Text style={[type.label, { color: colors.primary }]}>{label}</Text>
    </Pressable>
  );
}
