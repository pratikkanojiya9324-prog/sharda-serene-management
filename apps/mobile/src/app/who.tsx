import Ionicons from '@expo/vector-icons/Ionicons';
import { flatLabel } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { getActorName, setActorName } from '@/lib/actor';
import { firstStop, type Home } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { Avatar, Banner, Button, Card, Header, Input, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

type Member = { id: string; name: string; relation: string | null };

/**
 * "Who's using this phone?" — shown after a flat signs in on a device (params
 * `next`/`battery` say where to go afterwards) and from More to change it.
 */
export default function Who() {
  const router = useRouter();
  const { colors } = useTheme();
  const { next, battery } = useLocalSearchParams<{ next?: Home; battery?: string }>();
  const [label, setLabel] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [other, setOther] = useState(false);
  const [otherName, setOtherName] = useState('');

  const load = useCallback(async () => {
    setLoadError(false);
    setMembers(null);
    setCurrent(await getActorName());
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;
    const { data: links, error: linkError } = await supabase
      .from('flat_residents')
      .select('flat_id, flats(number, towers!flats_tower_id_fkey(name, building))')
      .eq('profile_id', userId ?? '');
    if (linkError) {
      setLoadError(true);
      setMembers([]);
      return;
    }
    const first = links?.[0]?.flats;
    if (first?.towers) setLabel(flatLabel(first.towers.building, first.towers.name, first.number));
    const flatIds = (links ?? []).map((l) => l.flat_id);
    const { data, error } = await supabase
      .from('family_members')
      .select('id, name, relation')
      .in('flat_id', flatIds)
      .order('name');
    if (error) setLoadError(true);
    setMembers(data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function choose(name: string) {
    await setActorName(name);
    if (next) router.replace(firstStop({ home: next, needsActorName: false, showBatteryGuide: battery === '1' }));
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <Screen scroll padded={false} edges={['bottom']}>
      <Header
        variant="hero"
        icon="people"
        overline={label ?? 'Society Gate'}
        title="Who's using this phone?"
        subtitle="Tap your name. It shows on visitor approvals and complaints, like “Approved by Rahul”."
        onBack={next ? undefined : () => router.back()}
      />
      <View style={{ paddingHorizontal: space.xl, marginTop: -48, gap: space.md, paddingBottom: space.xl }}>
        {members === null ? (
          <Card style={{ alignItems: 'center', paddingVertical: space.xxl }}>
            <ActivityIndicator color={colors.primary} />
          </Card>
        ) : null}

        {loadError ? <Banner text="Couldn't load your family list" /> : null}
        {loadError ? <Button title="Try again" icon="refresh" variant="secondary" onPress={load} /> : null}

        {members?.map((m) => {
          const selected = current === m.name;
          return (
            <Card
              key={m.id}
              onPress={() => choose(m.name)}
              accessibilityLabel={`I am ${m.name}`}
              style={[
                { flexDirection: 'row', alignItems: 'center', gap: space.md },
                selected && { borderColor: colors.primary, borderWidth: 1.5 },
              ]}>
              <Avatar name={m.name} />
              <View style={{ flex: 1 }}>
                <Text style={[type.heading, { color: colors.text }]}>{m.name}</Text>
                {m.relation ? <Text style={[type.caption, { color: colors.textMuted }]}>{m.relation}</Text> : null}
              </View>
              <Ionicons
                name={selected ? 'checkmark-circle' : 'chevron-forward'}
                size={22}
                color={selected ? colors.primary : colors.textSubtle}
              />
            </Card>
          );
        })}

        {members !== null ? (
          <Card
            onPress={other ? undefined : () => setOther(true)}
            accessibilityLabel="Someone else"
            style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Ionicons name="person-add-outline" size={20} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[type.heading, { color: colors.text }]}>Someone else</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  {members.length === 0 && !loadError ? 'No family members added yet. Type your name.' : 'Type your name'}
                </Text>
              </View>
              {!other ? <Ionicons name="chevron-forward" size={22} color={colors.textSubtle} /> : null}
            </View>
            {other ? (
              <>
                <Input
                  icon="person-outline"
                  value={otherName}
                  onChangeText={setOtherName}
                  placeholder="Your name"
                  accessibilityLabel="Your name"
                  autoFocus
                  autoCapitalize="words"
                  maxLength={60}
                  returnKeyType="done"
                  onSubmitEditing={() => otherName.trim() && choose(otherName)}
                />
                <Button
                  title="Continue"
                  iconRight="arrow-forward"
                  disabled={otherName.trim().length === 0}
                  onPress={() => choose(otherName)}
                />
              </>
            ) : null}
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}
