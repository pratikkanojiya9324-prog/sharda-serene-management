import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { IconBadge } from '@/components/resident';
import { passErrorText } from '@/lib/passErrors';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, Header, Screen } from '@/theme/components';
import { radius, space, type, useTheme } from '@/theme/tokens';

export default function PassScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function submit() {
    if (inFlight.current || code.length !== 6) return;
    inFlight.current = true;
    setError(null);
    setBusy(true);
    try {
      const { data, error: err } = await supabase.rpc('use_pass', { p_code: code });
      if (err) return setError(passErrorText(err.message));
      router.replace({ pathname: '/(guard)/visit/[id]', params: { id: data.id } });
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(guard)'));

  return (
    <Screen scroll>
      <Header overline="Gate" title="Pass code" subtitle="For guests the resident invited ahead" onBack={back} />
      <Card style={{ alignItems: 'center', gap: space.lg, paddingVertical: space.xl }}>
        <IconBadge icon="keypad" size={64} />
        <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>
          Enter the 6-digit code the visitor was given.
        </Text>
        <TextInput
          value={code}
          onChangeText={(t) => {
            setCode(t.replace(/\D/g, '').slice(0, 6));
            setError(null);
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          accessibilityLabel="Pass code"
          placeholder="••••••"
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          onSubmitEditing={submit}
          style={{
            alignSelf: 'stretch',
            textAlign: 'center',
            fontSize: 34,
            fontWeight: '800',
            letterSpacing: 12,
            paddingVertical: space.lg,
            borderRadius: radius.md,
            borderWidth: 2,
            borderColor: code.length === 6 ? colors.primary : colors.border,
            backgroundColor: colors.surfaceMuted,
            color: colors.text,
          }}
        />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: 6 }, (_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i < code.length ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
      </Card>
      {error ? <Banner text={error} /> : null}
      <Button
        title="Check pass"
        icon="shield-checkmark"
        loading={busy}
        disabled={code.length !== 6}
        onPress={submit}
      />
    </Screen>
  );
}
