import { Stack } from 'expo-router';

import { useTheme } from '@/theme/tokens';

// Each guard screen draws its own themed header (hero on Today, back row elsewhere).
export default function GuardLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
