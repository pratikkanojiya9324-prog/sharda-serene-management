import { normalizePhone } from '@society-gate/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

export default function Login() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setError(null);
    let phone: string;
    try {
      phone = normalizePhone(input);
    } catch {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({ phone });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.push({ pathname: '/verify', params: { phone } });
  }

  return (
    <View style={ui.screen}>
      <Text style={ui.title}>Society Gate</Text>
      <Text style={ui.body}>Enter your mobile number to get a login code.</Text>
      <TextInput
        style={ui.input}
        value={input}
        onChangeText={setInput}
        placeholder="98765 43210"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Pressable style={[ui.button, busy && ui.buttonDisabled]} disabled={busy} onPress={sendCode}>
        <Text style={ui.buttonText}>{busy ? 'Sending...' : 'Send code'}</Text>
      </Pressable>
    </View>
  );
}
