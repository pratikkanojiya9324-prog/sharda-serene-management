import type { Session } from '@supabase/supabase-js';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { bootstrapSignedInUser } from '@/lib/postLogin';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

export default function RootLayout() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const bootstrappedFor = useRef<string | null>(null);

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
      return;
    }
    if (bootstrappedFor.current === userId) return;
    bootstrappedFor.current = userId;
    bootstrapSignedInUser(userId)
      .then(({ home, showBatteryGuide }) => {
        if (showBatteryGuide) router.replace({ pathname: '/battery-guide', params: { next: home } });
        else router.replace(home);
      })
      .catch((e: unknown) => {
        bootstrappedFor.current = null;
        setBootError(e instanceof Error ? e.message : 'Something went wrong');
      });
  }, [ready, userId, router]);

  if (!ready) {
    return (
      <View style={ui.screen}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(guard)" />
          <Stack.Screen name="(resident)" />
          <Stack.Screen name="no-access" />
          <Stack.Screen name="battery-guide" />
        </Stack.Protected>
      </Stack>
      {bootError && session ? (
        <View style={{ position: 'absolute', bottom: 24, left: 24, right: 24 }}>
          <Text style={ui.error}>{bootError}</Text>
          <Text style={ui.secondaryText} onPress={() => supabase.auth.signOut()}>
            Sign out
          </Text>
        </View>
      ) : null}
    </>
  );
}
