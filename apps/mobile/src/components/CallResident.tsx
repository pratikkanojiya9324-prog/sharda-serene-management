import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

type Contact = { name: string; phone: string };

type Props = {
  flatId: string;
  visible: boolean;
  /** True when no resident of the flat has the app (no push could have reached anyone). */
  noAppUsers?: boolean;
};

export function CallResident({ flatId, visible, noAppUsers = false }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    supabase.rpc('flat_contacts', { p_flat_id: flatId }).then(({ data, error: err }) => {
      if (!active) return;
      if (err) setError(err.message);
      else setContacts(data ?? []);
    });
    return () => {
      active = false;
    };
  }, [flatId, visible]);

  if (!visible) return null;

  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.body}>
        {noAppUsers ? 'No one in this flat uses the app — call them' : 'No response yet — call the resident'}
      </Text>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {contacts.map((c) => (
        <Pressable key={c.phone} style={ui.button} onPress={() => Linking.openURL('tel:' + c.phone)}>
          <Text style={ui.buttonText}>
            Call {c.name} ({c.phone})
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
