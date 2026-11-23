import { Stack } from 'expo-router';

import { useTheme } from '@/theme/tokens';

// A poll opened from a notification still has the list underneath.
export const unstable_settings = { anchor: 'index' };

export default function PollsLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
