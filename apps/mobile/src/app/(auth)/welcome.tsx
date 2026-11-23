import { flatLabel } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { groupDirectory, loadDirectory, signInFlat, welcomeTitle, type Directory } from '@/lib/flatLogin';
import { Banner, Button, Card, EmptyState, Header, Input, Screen, Select } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

const SOCIETY_ID = process.env.EXPO_PUBLIC_SOCIETY_ID;

export default function Welcome() {
  const router = useRouter();
  const { colors } = useTheme();
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [building, setBuilding] = useState<string | null>(null);
  const [wing, setWing] = useState<string | null>(null);
  const [flatId, setFlatId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setDirectory(null);
    setDirectory(await loadDirectory(SOCIETY_ID));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const flats = directory?.status === 'ok' ? directory.flats : [];
  const groups = useMemo(() => groupDirectory(flats), [flats]);
  const wings = building ? groups.wings(building) : [];
  const flatChoices = building && wing ? groups.flats(building, wing) : [];
  const flat = flats.find((f) => f.flat_id === flatId) ?? null;

  // One building / one wing: choose it for the user.
  useEffect(() => {
    if (!building && groups.buildings.length === 1) setBuilding(groups.buildings[0]);
  }, [building, groups]);
  useEffect(() => {
    if (building && !wing && wings.length === 1) setWing(wings[0]);
  }, [building, wing, wings]);

  async function login() {
    if (!flat) return;
    setError(null);
    setBusy(true);
    // On success the root layout's auth listener takes over and routes onwards.
    try {
      const message = await signInFlat(flat, password);
      if (message) setError(message);
    } finally {
      setBusy(false);
    }
  }

  const societyName = directory?.status === 'ok' ? directory.societyName : null;

  return (
    <Screen scroll padded={false} edges={['bottom']}>
      <Header
        variant="hero"
        icon="home"
        overline="Society Gate"
        title={societyName ? welcomeTitle(societyName) : 'Welcome'}
        subtitle={societyName ?? undefined}>
        {directory === null ? <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-start' }} /> : null}
      </Header>

      <View style={{ paddingHorizontal: space.xl, marginTop: -48, gap: space.lg }}>
        {directory?.status === 'ok' ? (
          <Card style={{ gap: space.lg, padding: space.xl }}>
            <View style={{ gap: 2 }}>
              <Text style={[type.title, { color: colors.text }]}>Sign in to your flat</Text>
              <Text style={[type.caption, { color: colors.textMuted }]}>
                One login for the whole family. Ask your society office for the password.
              </Text>
            </View>

            <Select
              label="Building"
              icon="business-outline"
              placeholder="Choose building"
              value={building}
              options={groups.buildings.map((b) => ({ value: b, label: b }))}
              onChange={(b) => {
                if (b === building) return;
                setBuilding(b);
                setWing(null);
                setFlatId(null);
                setError(null);
              }}
            />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Select
                label="Wing"
                style={{ flex: 1 }}
                icon="grid-outline"
                placeholder="Wing"
                sheetTitle={building ? `${building} · Wing` : 'Wing'}
                value={wing}
                disabled={!building}
                options={wings.map((w) => ({ value: w, label: `Wing ${w}` }))}
                onChange={(w) => {
                  if (w === wing) return;
                  setWing(w);
                  setFlatId(null);
                  setError(null);
                }}
              />
              <Select
                label="Flat"
                style={{ flex: 1 }}
                icon="key-outline"
                placeholder="Flat"
                sheetTitle={building && wing ? `${building} · Wing ${wing}` : 'Flat'}
                columns={4}
                value={flatId}
                disabled={!wing}
                options={flatChoices.map((f) => ({ value: f.flat_id, label: f.flat_number }))}
                onChange={(id) => {
                  setFlatId(id);
                  setError(null);
                }}
              />
            </View>

            <Input
              label="Password"
              icon="lock-closed-outline"
              password
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              placeholder={flat ? `Password for ${flatLabel(flat.building, flat.wing, flat.flat_number)}` : 'Password'}
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
              disabled={!flat || password.length === 0}
            />
          </Card>
        ) : null}

        {directory?.status === 'not_configured' ? (
          <Card>
            <EmptyState
              icon="construct-outline"
              tone="accent"
              title="App not configured"
              message="This app isn't linked to a society yet. Please contact your society office."
            />
          </Card>
        ) : null}

        {directory?.status === 'offline' ? (
          <Card>
            <EmptyState
              icon="cloud-offline-outline"
              tone="danger"
              title="Can't reach the server"
              message="Check your internet connection and try again."
              action={<Button title="Try again" icon="refresh" variant="secondary" onPress={load} />}
            />
          </Card>
        ) : null}

        <Pressable
          onPress={() => router.push('/staff-login')}
          accessibilityRole="link"
          style={({ pressed }) => [
            { alignSelf: 'center', paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: 999 },
            pressed && { backgroundColor: colors.primarySoft },
          ]}>
          <Text style={[type.label, { color: colors.primary }]}>Guard / Admin login →</Text>
        </Pressable>
      </View>
    </Screen>
  );
}
