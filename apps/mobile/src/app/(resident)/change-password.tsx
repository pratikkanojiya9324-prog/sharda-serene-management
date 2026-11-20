import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { IconBadge } from '@/components/resident';
import { MIN_PASSWORD_LENGTH, newPasswordError } from '@/lib/password';
import { useResidentFlat } from '@/lib/residentFlat';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, Header, Input, Screen } from '@/theme/components';
import { type, useTheme } from '@/theme/tokens';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat } = useResidentFlat();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const validation = newPasswordError(password, confirm);

  async function save() {
    setTouched(true);
    setError(null);
    if (validation) return;
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(
        err.code === 'same_password'
          ? 'That is already the password. Choose a new one.'
          : err.code === 'weak_password'
            ? 'Choose a stronger password'
            : 'Could not change the password, try again',
      );
      return;
    }
    setPassword('');
    setConfirm('');
    setTouched(false);
    setDone(true);
  }

  return (
    <Screen scroll>
      <Header title="Change password" subtitle={flat ? `Flat ${flat.label}` : undefined} onBack={() => router.back()} />
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <IconBadge icon="people" tone="info" />
        <Text style={[type.body, { color: colors.textMuted, flex: 1 }]}>
          Everyone in your flat uses this password. Tell your family after changing it.
        </Text>
      </Card>
      <Card>
        <Input
          label="New password"
          password
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setDone(false);
          }}
          autoCapitalize="none"
          autoComplete="new-password"
          icon="lock-closed-outline"
          error={touched && password.length < MIN_PASSWORD_LENGTH ? validation : null}
        />
        <Input
          label="Confirm new password"
          password
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t);
            setDone(false);
          }}
          autoCapitalize="none"
          autoComplete="new-password"
          icon="lock-closed-outline"
          error={touched && password.length >= MIN_PASSWORD_LENGTH ? validation : null}
        />
        <Text style={[type.caption, { color: colors.textSubtle }]}>At least {MIN_PASSWORD_LENGTH} characters.</Text>
      </Card>
      {error ? <Banner text={error} /> : null}
      {done ? <Banner text="Password changed" tone="success" /> : null}
      <Button title="Change password" icon="checkmark" loading={busy} disabled={!password || !confirm} onPress={save} />
    </Screen>
  );
}
