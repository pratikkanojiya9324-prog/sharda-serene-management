import type { Session } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';

import { notificationTarget } from '@/lib/notificationRoute';
import { bootstrapSignedInUser } from '@/lib/postLogin';
import { registerPushToken, type PushStatus } from '@/lib/push';
import { PushStatusContext } from '@/lib/pushStatus';
import { SessionContext } from '@/lib/sessionContext';
import { firstStop, type Role } from '@/lib/session';
import { signOut } from '@/lib/signOut';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card } from '@/theme/components';
import { space, useTheme } from '@/theme/tokens';

// Show visitor alerts even while the app is open (default is to drop them silently).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Survives remounts so one notification tap is only ever handled once.
let handledNotificationId: string | null = null;

export default function RootLayout() {
  const router = useRouter();
  const { colors } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  // Bumped by "Try again" to re-run the bootstrap after an error.
  const [bootAttempt, setBootAttempt] = useState(0);
  const bootstrappedFor = useRef<string | null>(null);
  // Covers both a tap while running and a cold start from a notification.
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!ready) return;
    if (!userId) {
      bootstrappedFor.current = null;
      setBootError(null);
      setRoles(null);
      setPushStatus(null);
      return;
    }
    if (bootstrappedFor.current === userId) return;
    bootstrappedFor.current = userId;
    bootstrapSignedInUser(userId)
      .then((result) => {
        setPushStatus(result.pushStatus);
        router.replace(firstStop(result));
        setRoles(result.roles);
      })
      .catch((e: unknown) => {
        bootstrappedFor.current = null;
        setBootError(e instanceof Error ? e.message : 'Something went wrong');
      });
  }, [ready, userId, router, bootAttempt]);

  const retryBootstrap = () => {
    bootstrappedFor.current = null;
    setBootError(null);
    setBootAttempt((n) => n + 1);
  };

  // Back from the phone's settings (the "Fix" button): try push registration again.
  const recheckPush = useCallback(async () => setPushStatus(await registerPushToken()), []);
  const pushBroken = pushStatus !== null && pushStatus !== 'ok';
  useEffect(() => {
    if (!pushBroken) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recheckPush();
    });
    return () => sub.remove();
  }, [pushBroken, recheckPush]);

  // Notification taps: wait until the bootstrap knows the user's roles.
  useEffect(() => {
    if (!response || !roles) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = response.notification.request.identifier;
    if (handledNotificationId === id) return;
    handledNotificationId = id;
    const target = notificationTarget(response.notification.request.content.data, roles);
    if (target) router.push(target);
  }, [response, roles, router]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SessionContext.Provider value={session}>
    <PushStatusContext.Provider value={pushStatus}>
      <Stack screenOptions={{ headerShown: false }}>
        {/* "/" must exist for everyone: the app always opens there. */}
        <Stack.Screen name="index" />
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(guard)" />
          <Stack.Screen name="(resident)" />
          <Stack.Screen name="who" />
          <Stack.Screen name="no-access" />
          <Stack.Screen name="battery-guide" />
        </Stack.Protected>
      </Stack>
      {bootError && session ? (
        <Card style={{ position: 'absolute', bottom: space.xl, left: space.xl, right: space.xl }}>
          <Banner text={`Could not load your account: ${bootError}`} />
          <Button title="Try again" icon="refresh" onPress={retryBootstrap} />
          <Button title="Sign out" icon="log-out-outline" variant="ghost" onPress={() => signOut()} />
        </Card>
      ) : null}
    </PushStatusContext.Provider>
    </SessionContext.Provider>
  );
}
