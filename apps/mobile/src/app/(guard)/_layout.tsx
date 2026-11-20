import { Stack } from 'expo-router';

export default function GuardLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Today' }} />
      <Stack.Screen name="new-visit" options={{ title: 'New visitor' }} />
      <Stack.Screen name="pass" options={{ title: 'Enter pass code' }} />
      <Stack.Screen name="visit/[id]" options={{ title: 'Visit' }} />
    </Stack>
  );
}
