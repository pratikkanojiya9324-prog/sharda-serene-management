import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { signInStaff } from '@/lib/flatLogin';
import { Banner, Button, Card, EmptyState, Header, Input, Screen } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

const SOCIETY_ID = process.env.EXPO_PUBLIC_SOCIETY_ID;

export default function StaffLogin() {
  const router = useRouter();
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/welcome'));

  async function login() {
    if (!SOCIETY_ID) return;
    setError(null);
    setBusy(true);
    // On success the root layout's auth listener routes to the guard/admin home.
    const message = await signInStaff(username, password, SOCIETY_ID);
    setBusy(false);
    if (message) setError(message);
  }

  return (
    <Screen scroll padded={false} edges={['bottom']}>
      <Header
        variant="hero"
        icon="shield-checkmark"
        overline="Society Gate"
        title="Staff login"
        subtitle="For guards and society admins"
        onBack={back}
      />
      <View style={{ paddingHorizontal: space.xl, marginTop: -48, gap: space.lg }}>
        <Card style={{ gap: space.lg, padding: space.xl }}>
          {SOCIETY_ID ? (
            <>
              <View style={{ gap: 2 }}>
                <Text style={[type.title, { color: colors.text }]}>Sign in</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>
                  Use the username and password your admin gave you.
                </Text>
              </View>
              <Input
                label="Username"
                icon="person-outline"
                value={username}
                onChangeText={(t) => {
                  setUsername(t);
                  setError(null);
                }}
                placeholder="e.g. guard1"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                returnKeyType="next"
              />
              <Input
                label="Password"
                icon="lock-closed-outline"
                password
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
                placeholder="Password"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={login}
              />
              {error ? <Banner text={error} /> : null}
              <Button
                title="Login"
                iconRight="arrow-forward"
                onPress={login}
                loading={busy}
                disabled={username.trim().length === 0 || password.length === 0}
              />
            </>
          ) : (
            <EmptyState
              icon="construct-outline"
              tone="accent"
              title="App not configured"
              message="This app isn't linked to a society yet. Please contact your society office."
            />
          )}
        </Card>
        <Button title="Flat login" icon="home-outline" variant="ghost" onPress={back} />
      </View>
    </Screen>
  );
}
