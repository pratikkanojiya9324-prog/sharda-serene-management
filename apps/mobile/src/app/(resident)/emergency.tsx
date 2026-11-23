import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';

import { EmergencyContactCards, fetchEmergencyContacts, type Contact } from '@/components/EmergencyContacts';
import { ErrorState, Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { Banner, EmptyState, Header, Screen } from '@/theme/components';

export default function EmergencyScreen() {
  const router = useRouter();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    if (!flatId) return;
    const res = await fetchEmergencyContacts();
    if (res.error) {
      setError(res.error);
      return false;
    }
    setError(null);
    setContacts(res.contacts);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading: loading, hasFlat: !!flat });

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
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : contacts.length ? (
        <EmergencyContactCards contacts={contacts} />
      ) : (
        <EmptyState icon="call-outline" title="No numbers yet" message="The office will add the society's emergency numbers here." />
      )}
    </Screen>
  );
}
