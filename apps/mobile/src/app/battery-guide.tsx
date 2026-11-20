import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';

import { markBatteryGuideShown } from '@/lib/postLogin';
import type { Home } from '@/lib/session';
import { Button, Card, EmptyState, Screen } from '@/theme/components';

export default function BatteryGuide() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: Home }>();

  async function finish() {
    await markBatteryGuideShown();
    router.replace(next ?? '/');
  }

  return (
    <Screen contentStyle={{ justifyContent: 'center' }}>
      <Card>
        <EmptyState
          icon="battery-charging-outline"
          tone="accent"
          title="Don't miss visitors"
          message={
            'Some phones (Xiaomi, Oppo, Vivo, Realme, Samsung) block notifications to save battery. Open the ' +
            'settings for Society Gate and set Battery to "No restrictions" (or "Unrestricted") so visitor ' +
            'alerts always reach you.'
          }
        />
        <Button title="Open settings" icon="settings-outline" onPress={() => Linking.openSettings()} />
        <Button title="Done" variant="ghost" onPress={finish} />
      </Card>
    </Screen>
  );
}
