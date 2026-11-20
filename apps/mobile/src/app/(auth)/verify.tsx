import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

export default function Verify() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setError(null);
    setBusy(true);
    // On success the auth listener in the root layout claims invites and routes to the right home.
    const { error: err } = await supabase.auth.verifyOtp({ phone, token: code, type: 'sms' });
    setBusy(false);
    if (err) setError(err.message);
  }

  return (
    <View style={ui.screen}>
      <Text style={ui.title}>Enter code</Text>
      <Text style={ui.body}>We sent a 6-digit code to {phone}.</Text>
      <TextInput
        style={ui.input}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        placeholder="123456"
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={6}
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Pressable
        style={[ui.button, (busy || code.length !== 6) && ui.buttonDisabled]}
        disabled={busy || code.length !== 6}
        onPress={verify}>
        <Text style={ui.buttonText}>{busy ? 'Verifying...' : 'Verify'}</Text>
      </Pressable>
    </View>
  );
}
