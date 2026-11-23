import { EMERGENCY_CONTACT_SELECT } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { reportError } from '@/lib/errors';
import { useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Contact = { id: string; name: string; phone: string; note: string | null };

export default function EmergencyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('emergency_contacts')
      .select(EMERGENCY_CONTACT_SELECT)
      .order('sort_order')
      .order('created_at');
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setContacts(data ?? []);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading: loading, hasFlat: !!flat });

  async function call(c: Contact) {
    setCallError(null);
    try {
      await Linking.openURL(`tel:${c.phone}`);
    } catch {
      setCallError(`Could not start the call. Dial ${c.phone}.`);
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
      <Header overline="Society" title="Emergency numbers" onBack={back} />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {callError ? <Banner text={callError} /> : null}
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : contacts.length ? (
        contacts.map((c) => (
          <Card key={c.id} style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <IconBadge icon="call" tone="danger" />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.heading, { color: colors.text }]}>{c.name}</Text>
                <Text style={[type.caption, { color: colors.textMuted }]} selectable>
                  {c.phone}
                </Text>
              </View>
            </View>
            {c.note ? <Text style={[type.body, { color: colors.textMuted }]}>{c.note}</Text> : null}
            <Button title={`Call ${c.name}`} icon="call" variant="danger" onPress={() => call(c)} />
          </Card>
        ))
      ) : (
        <EmptyState icon="call-outline" title="No numbers yet" message="The office will add the society's emergency numbers here." />
      )}
    </Screen>
  );
}
