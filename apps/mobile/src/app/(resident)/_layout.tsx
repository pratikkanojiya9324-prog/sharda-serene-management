import { Stack, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { ResidentFlatProvider } from '@/lib/residentFlat';

// Survives layout remounts so one tap is only ever handled once.
let handledNotificationId: string | null = null;

export default function ResidentLayout() {
  const router = useRouter();
  // Covers both a tap while running and a cold start from a notification.
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handledNotificationId === id) return;
    handledNotificationId = id;
    const data = response.notification.request.content.data as { visitId?: string; type?: string };
    if (data.type === 'visit_request' && data.visitId) {
      router.push({ pathname: '/(resident)/request/[id]', params: { id: data.visitId } });
    } else if (data.type === 'pass_used') {
      router.push('/(resident)/history');
    }
  }, [response, router]);

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
