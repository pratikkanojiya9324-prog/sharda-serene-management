import { Stack } from 'expo-router';

import { useTheme } from '@/theme/tokens';

// A detail opened from a notification or deep link still has the list underneath.
export const unstable_settings = { anchor: 'index' };

export default function DailyHelpLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
