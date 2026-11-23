import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { IconBadge, useFocusLoad } from '@/components/resident';
import { getActorName } from '@/lib/actor';
import { useResidentFlat } from '@/lib/residentFlat';
import { signOut } from '@/lib/signOut';
import { Avatar, Card, Header, Screen, type IconName } from '@/theme/components';
import { space, type, useTheme, type Tone } from '@/theme/tokens';

export default function MoreScreen() {
  const { colors } = useTheme();
  const { flat } = useResidentFlat();
  const [actor, setActor] = useState<string | null>(null);

  const load = useCallback(async () => setActor(await getActorName()), []);
  useFocusLoad(load);

  const confirmLogout = () =>
    Alert.alert('Log out?', 'Anyone using this phone will need the flat password to log in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <Screen scroll edges={['top']}>
      <Header title="More" />
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={actor ?? flat?.label ?? '?'} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]}>{actor ?? 'Name not set'}</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>Flat {flat?.label ?? '—'}</Text>
        </View>
      </Card>

      <Group title="Visitors">
        <Row icon="ticket" label="Guest passes" hint="Codes for expected guests" href="/(resident)/passes" />
        <Row icon="time" label="Visitor history" hint="Everyone who came to your flat" href="/(resident)/history" />
      </Group>

      <Group title="Daily gate">
        <Row icon="people" label="Daily help" hint="Maid, cook, driver: gate codes and attendance" href="/(resident)/daily-help" />
        <Row icon="timer" label="Expected deliveries" hint="Let a delivery or cab in without asking" href="/(resident)/expecting" />
        <Row icon="cube" label="Parcels" hint="Parcels held at the gate" href="/(resident)/parcels" />
      </Group>

      <Group title="Community">
        <Row icon="stats-chart" label="Polls" hint="Vote on society decisions" href="/(resident)/polls" />
      </Group>

      <Group title="This phone">
        <Row
          icon="person-circle"
          label="Who's using this phone?"
          hint={actor ? `Currently ${actor}` : 'Choose your name'}
          href="/who"
        />
        <Row icon="key" label="Change password" hint="For the whole flat" href="/(resident)/change-password" />
      </Group>

      <Card onPress={confirmLogout} accessibilityLabel="Log out" style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconBadge icon="log-out" tone="danger" size={40} />
        <Text style={[type.heading, { color: colors.danger, flex: 1 }]}>Log out</Text>
      </Card>
    </Screen>
  );
}

function Row({ icon, label, hint, href, tone = 'brand' }: { icon: IconName; label: string; hint?: string; href: Href; tone?: Tone }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.push(href)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.sm,
        opacity: pressed ? 0.6 : 1,
      })}>
      <IconBadge icon={icon} tone={tone} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={[type.heading, { color: colors.text }]}>{label}</Text>
        {hint ? <Text style={[type.caption, { color: colors.textMuted }]}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text style={[type.overline, { color: colors.textSubtle, paddingHorizontal: space.xs }]}>{title.toUpperCase()}</Text>
      <Card style={{ gap: space.xs, paddingVertical: space.sm }}>{children}</Card>
    </View>
  );
}
