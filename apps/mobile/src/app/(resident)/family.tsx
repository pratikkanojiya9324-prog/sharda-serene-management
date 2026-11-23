import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { useCallback, useRef, useState } from 'react';
import { Linking, Pressable, Switch, Text, View } from 'react-native';

import { ErrorState, Loading, NoFlatState, useFocusLoad } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { reportError } from '@/lib/errors';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { supabase } from '@/lib/supabase';
import { Avatar, Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Member = Pick<Database['public']['Tables']['family_members']['Row'], 'id' | 'name' | 'phone' | 'relation' | 'in_directory' | 'show_phone'>;

/** Read-only list of the flat's family members (the society office manages it). */
export default function FamilyScreen() {
  const { colors } = useTheme();
  const { flat, loading: flatLoading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [members, setMembers] = useState<Member[]>([]);
  const [actor, setActor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setActor(await getActorName());
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('family_members')
      .select('id, name, phone, relation, in_directory, show_phone')
      .eq('flat_id', flatId)
      .order('created_at');
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setMembers(data ?? []);
  }, [flatId]);
  async function setVisibility(m: Member, inDirectory: boolean, showPhone: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setSavingId(m.id);
    setSaveError(null);
    try {
      const { error: err } = await supabase.rpc('set_directory_visibility', {
        p_member_id: m.id,
        p_in_directory: inDirectory,
        p_show_phone: showPhone,
      });
      if (err) return setSaveError(reportError(err));
      setMembers((cur) => cur.map((x) => (x.id === m.id ? { ...x, in_directory: inDirectory, show_phone: showPhone } : x)));
    } finally {
      setSavingId(null);
      inFlight.current = false;
    }
  }

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
      {saveError ? <Banner text={saveError} /> : null}
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
          The society office keeps this list. Guards use these numbers to call your flat about visitors. Neighbours only see members you switch on for the directory.
        </Text>
      </View>
    </Screen>
  );
}

function ToggleRow({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Text style={[type.body, { color: colors.text, flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}
