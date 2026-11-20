import { Stack } from 'expo-router';

import { ResidentFlatProvider } from '@/lib/residentFlat';

// Notification taps are handled in the root layout (they must also work for a
// user whose home is the guard screen).
export default function ResidentLayout() {
  return (
    <ResidentFlatProvider>
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Home' }} />
        <Stack.Screen name="request/[id]" options={{ title: 'Visitor request' }} />
        <Stack.Screen name="passes" options={{ title: 'Guest passes' }} />
        <Stack.Screen name="household" options={{ title: 'Household' }} />
        <Stack.Screen name="history" options={{ title: 'History' }} />
      </Stack>
    </ResidentFlatProvider>
  );
}
