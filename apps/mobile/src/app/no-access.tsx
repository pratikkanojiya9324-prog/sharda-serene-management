import { Linking } from 'react-native';

import { signOut } from '@/lib/signOut';
import { Button, Card, EmptyState, Screen } from '@/theme/components';

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL;

export default function NoAccess() {
  return (
    <Screen contentStyle={{ justifyContent: 'center' }}>
      <Card>
        <EmptyState
          icon="lock-closed-outline"
          tone="accent"
          title="No access in the app"
          message="This account isn't linked to a flat, guard or admin role yet. Please contact your society office."
        />
        {ADMIN_URL ? (
          <Button title="Open admin website" icon="open-outline" onPress={() => Linking.openURL(ADMIN_URL)} />
        ) : null}
        <Button title="Sign out" icon="log-out-outline" variant="secondary" onPress={() => signOut()} />
      </Card>
    </Screen>
  );
}
