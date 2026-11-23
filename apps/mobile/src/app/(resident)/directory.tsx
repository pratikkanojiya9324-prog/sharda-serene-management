import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { filterDirectory } from '@/lib/community';
import { reportError } from '@/lib/errors';
import { useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Avatar, Banner, Card, EmptyState, Header, Input, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Entry = { flat_id: string; flat_label: string; name: string; relation: string | null; phone: string | null };

export default function DirectoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading, error: flatError, reload } = useResidentFlat();
  const [rows, setRows] = useState<Entry[]>([]);
  const [committee, setCommittee] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);
  const flatId = flat?.id ?? null;

  const load = useCallback(async () => {
    if (!flatId) return;
    const [d, c] = await Promise.all([supabase.rpc('resident_directory'), supabase.rpc('directory_committee')]);
    const err = d.error ?? c.error;
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setRows(d.data ?? []);
    setCommittee((c.data ?? []).map((m) => m.name));
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading: loading, hasFlat: !!flat });

  const flats = useMemo(() => {
    const byFlat = new Map<string, { label: string; members: Entry[] }>();
    for (const r of filterDirectory(rows, query)) {
      const g = byFlat.get(r.flat_id) ?? { label: r.flat_label, members: [] };
      g.members.push(r);
      byFlat.set(r.flat_id, g);
    }
    return [...byFlat.entries()]
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  }, [rows, query]);

  async function call(phone: string) {
    setCallError(null);
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      setCallError(`Could not start the call. Dial ${phone}.`);
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
  const searching = query.trim() !== '';

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline="Society" title="Directory" subtitle="Neighbours who chose to be listed" onBack={back} />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {callError ? <Banner text={callError} /> : null}
      {state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : (
        <>
          {rows.length ? (
            <Input
              icon="search"
              placeholder="Search by name or flat"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          ) : null}

          {committee.length && !searching ? (
            <>
              <SectionTitle title="Committee" count={committee.length} />
              <Card style={{ gap: space.sm }}>
                {committee.map((name) => (
                  <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                    <IconBadge icon="ribbon" tone="accent" size={36} />
                    <Text style={[type.body, { color: colors.text, flex: 1 }]}>{name}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}

          {!rows.length ? (
            <EmptyState
              icon="people-outline"
              title="Directory is empty"
              message="No one has joined the directory yet. Turn it on for your family in the Family tab."
            />
          ) : flats.length ? (
            flats.map((g) => (
              <View key={g.id} style={{ gap: space.sm }}>
                <SectionTitle title={g.label} />
                <Card style={{ gap: space.md }}>
                  {g.members.map((m, i) => (
                    <View key={`${m.name}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <Avatar name={m.name} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={[type.heading, { color: colors.text }]}>{m.name}</Text>
                        {m.relation ? <Text style={[type.caption, { color: colors.textMuted }]}>{m.relation}</Text> : null}
                      </View>
                      {m.phone ? (
                        <Pressable
                          onPress={() => call(m.phone as string)}
                          accessibilityRole="button"
                          accessibilityLabel={`Call ${m.name}`}
                          hitSlop={8}
                          style={({ pressed }) => ({
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: pressed ? colors.primary : colors.primarySoft,
                          })}>
                          {({ pressed }) => <Ionicons name="call" size={20} color={pressed ? colors.onPrimary : colors.primary} />}
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </Card>
              </View>
            ))
          ) : (
            <EmptyState icon="search" title="No match" message="Try a different name or flat." />
          )}
        </>
      )}
    </Screen>
  );
}
