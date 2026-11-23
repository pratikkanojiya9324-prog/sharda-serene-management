import Ionicons from '@expo/vector-icons/Ionicons';
import { DOCUMENT_SELECT, type DocCategory } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { groupDocuments } from '@/lib/community';
import { reportError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import { useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Card, EmptyState, Header, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Doc = {
  id: string;
  title: string;
  category: DocCategory;
  file_path: string;
  file_kind: string;
  created_at: string;
};

export default function DocumentsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('documents')
      .select(DOCUMENT_SELECT)
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setDocs(data ?? []);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading: loading, hasFlat: !!flat });

  /** Same approach as notice attachments: a fresh signed URL opened in the phone's viewer. */
  async function open(doc: Doc) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusyId(doc.id);
    setOpenError(null);
    try {
      const { data, error: err } = await supabase.storage.from('society-docs').createSignedUrl(doc.file_path, 3600);
      if (err || !data?.signedUrl) return setOpenError('Could not open the document, try again');
      try {
        await Linking.openURL(data.signedUrl);
      } catch {
        setOpenError(doc.file_kind === 'pdf' ? 'No app on this phone can open PDFs' : 'Could not open the file');
      }
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
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)/more'));

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline="Society" title="Documents" subtitle="Bylaws, minutes and forms" onBack={back} />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {openError ? <Banner text={openError} /> : null}
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : docs.length ? (
        groupDocuments(docs).map((g) => (
          <View key={g.category} style={{ gap: space.sm }}>
            <SectionTitle title={g.label} count={g.items.length} />
            {g.items.map((d) => (
              <Card
                key={d.id}
                onPress={busyId ? undefined : () => open(d)}
                accessibilityLabel={`${d.title}, ${d.file_kind === 'pdf' ? 'PDF' : 'image'}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, opacity: busyId === d.id ? 0.6 : 1 }}>
                <IconBadge icon={d.file_kind === 'pdf' ? 'document-text' : 'image'} tone={d.file_kind === 'pdf' ? 'danger' : 'info'} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[type.heading, { color: colors.text }]}>{d.title}</Text>
                  <Text style={[type.caption, { color: colors.textMuted }]}>
                    {d.file_kind === 'pdf' ? 'PDF' : 'Image'} · added {formatDate(d.created_at)}
                  </Text>
                </View>
                <Ionicons name="open-outline" size={20} color={colors.textSubtle} />
              </Card>
            ))}
          </View>
        ))
      ) : (
        <EmptyState icon="document-text-outline" title="No documents yet" message="The office will add bylaws, minutes and forms here." />
      )}
    </Screen>
  );
}
