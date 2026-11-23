import { Stack } from 'expo-router';

import { useTheme } from '@/theme/tokens';

// A screen opened from a notification still has the list underneath.
export const unstable_settings = { anchor: 'index' };

export default function EventsLayout() {
  const { colors } = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />;
}
