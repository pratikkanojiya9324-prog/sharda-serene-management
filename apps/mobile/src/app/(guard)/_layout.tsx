import { Stack } from 'expo-router';
import { View } from 'react-native';

import { SosBanner } from '@/components/SosBanner';
import { useGuardSociety } from '@/lib/guardSociety';

import { useTheme } from '@/theme/tokens';

// Each guard screen draws its own themed header (hero on Today, back row elsewhere).
export default function GuardLayout() {
  const { colors } = useTheme();
  const { societyId } = useGuardSociety();
  return (
    <View style={{ flex: 1 }}>
      <SosBanner societyId={societyId} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </View>
  );
}
