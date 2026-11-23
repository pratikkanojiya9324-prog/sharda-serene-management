import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { ErrorState, Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { reportError } from '@/lib/errors';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Avatar, Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Member = Pick<Database['public']['Tables']['family_members']['Row'], 'id' | 'name' | 'phone' | 'relation'>;

/** Read-only list of the flat's family members (the society office manages it). */
export default function FamilyScreen() {
  const { colors } = useTheme();
  const { flat, loading: flatLoading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [members, setMembers] = useState<Member[]>([]);
  const [actor, setActor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setActor(await getActorName());
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('family_members')
      .select('id, name, phone, relation')
      .eq('flat_id', flatId)
      .order('created_at');
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setMembers(data ?? []);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading, hasFlat: !!flat });
  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header
        overline={flat?.label}
        title="Family"
        subtitle={members.length ? `${members.length} member${members.length > 1 ? 's' : ''} in this flat` : undefined}
      />
      <FlatSwitcher />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {state === 'no_flat' ? (
        <NoFlatState message={flatError} onRetry={reload} />
      ) : state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : members.length ? (
        <>
          {members.map((m) => (
            <Card key={m.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Avatar name={m.name} size={48} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[type.heading, { color: colors.text }]}>{m.name}</Text>
                <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
                  {m.relation ? <Text style={[type.caption, { color: colors.textMuted }]}>{m.relation}</Text> : null}
                  {actor && actor.trim().toLowerCase() === m.name.trim().toLowerCase() ? <Pill label="This phone" tone="brand" icon="phone-portrait-outline" /> : null}
                </View>
              </View>
              {m.phone ? (
                <Pressable
                  onPress={() => Linking.openURL(`tel:${m.phone}`)}
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
            </Card>
          ))}
        </>
      ) : (
        <EmptyState icon="people-outline" title="No family members listed" message="Ask the society office to add your family." />
      )}
      <View style={{ flexDirection: 'row', gap: space.sm, paddingHorizontal: space.xs }}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textSubtle} />
        <Text style={[type.caption, { color: colors.textMuted, flex: 1 }]}>
          The society office keeps this list. Guards use these numbers to call your flat about visitors.
        </Text>
      </View>
    </Screen>
  );
}
