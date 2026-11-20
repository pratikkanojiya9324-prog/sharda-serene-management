import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { passErrorText } from '@/lib/passErrors';
import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

export default function PassScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.rpc('use_pass', { p_code: code });
    setBusy(false);
    if (err) {
      setError(passErrorText(err.message));
      return;
    }
    router.replace({ pathname: '/visit/[id]', params: { id: data.id } });
  }

  return (
    <View style={ui.screen}>
      <Text style={ui.body}>Enter the 6-digit pass code the visitor was given.</Text>
      <TextInput
        style={[ui.input, { letterSpacing: 8, textAlign: 'center', fontSize: 28 }]}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus
      />
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Pressable
        style={[ui.button, (busy || code.length !== 6) && ui.buttonDisabled]}
        disabled={busy || code.length !== 6}
        onPress={submit}
      >
        <Text style={ui.buttonText}>{busy ? 'Checking...' : 'Check pass'}</Text>
      </Pressable>
    </View>
  );
}
