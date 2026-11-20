import { Alert, Text, View } from 'react-native';

import { IconBadge } from '@/components/resident';
import { useAdminSociety } from '@/lib/adminSociety';
import { signOut } from '@/lib/signOut';
import { Avatar, Banner, Card, Header, Pill, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

export default function AdminMoreScreen() {
  const { colors } = useTheme();
  const { societyName, userName, error } = useAdminSociety();

  const confirmLogout = () =>
    Alert.alert('Sign out?', 'You will need your username and password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <Screen scroll edges={['top']}>
      <Header title="More" />
      {error ? <Banner text={error} /> : null}
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={userName ?? 'Admin'} size={56} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.heading, { color: colors.text }]}>{userName ?? 'Admin'}</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>{societyName ?? '—'}</Text>
          <Pill label="Admin" tone="brand" icon="shield-checkmark" />
        </View>
      </Card>

      <Card style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <IconBadge icon="desktop-outline" tone="info" size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]}>More on the admin website</Text>
          <Text style={[type.body, { color: colors.textMuted }]}>
            Flats and family import, staff accounts, password resets and bill generation are on the admin
            website.
          </Text>
        </View>
      </Card>

      <Card onPress={confirmLogout} accessibilityLabel="Sign out" style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconBadge icon="log-out" tone="danger" size={40} />
        <Text style={[type.heading, { color: colors.danger, flex: 1 }]}>Sign out</Text>
      </Card>
    </Screen>
  );
}
