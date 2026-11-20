import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { markBatteryGuideShown } from '@/lib/postLogin';
import type { Home } from '@/lib/session';
import { ui } from '@/lib/ui';

export default function BatteryGuide() {
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: Home }>();

  async function finish() {
    await markBatteryGuideShown();
    router.replace(next ?? '/');
  }

  return (
    <View style={ui.screen}>
      <Text style={ui.title}>Don't miss visitors</Text>
      <Text style={ui.body}>
        Some phones (Xiaomi, Oppo, Vivo, Realme, Samsung) block notifications to save battery. Open the
        settings for Society Gate and set Battery to "No restrictions" (or "Unrestricted") so visitor alerts
        always reach you.
      </Text>
      <Pressable style={ui.button} onPress={() => Linking.openSettings()}>
        <Text style={ui.buttonText}>Open settings</Text>
      </Pressable>
      <Pressable style={ui.secondary} onPress={finish}>
        <Text style={ui.secondaryText}>Done</Text>
      </Pressable>
    </View>
  );
}
