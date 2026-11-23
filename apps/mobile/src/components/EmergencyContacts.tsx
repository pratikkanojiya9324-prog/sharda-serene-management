import { EMERGENCY_CONTACT_SELECT } from '@society-gate/shared';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { IconBadge } from '@/components/resident';
import { reportError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

export type Contact = { id: string; name: string; phone: string; note: string | null };

/** The society's emergency numbers. Returns `error` text instead of throwing. */
export async function fetchEmergencyContacts(): Promise<{ contacts: Contact[]; error: string | null }> {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .select(EMERGENCY_CONTACT_SELECT)
    .order('sort_order')
    .order('created_at');
  if (error) return { contacts: [], error: reportError(error) };
  return { contacts: data ?? [], error: null };
}

/** One card per number with a Call button; a failed call shows the number to dial by hand. */
export function EmergencyContactCards({ contacts }: { contacts: Contact[] }) {
  const { colors } = useTheme();
  const [callError, setCallError] = useState<string | null>(null);

  async function call(c: Contact) {
    setCallError(null);
    try {
      await Linking.openURL(`tel:${c.phone}`);
    } catch {
      setCallError(`Could not start the call. Dial ${c.phone}.`);
    }
  }

  return (
    <>
      {callError ? <Banner text={callError} /> : null}
      {contacts.map((c) => (
        <Card key={c.id} style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconBadge icon="call" tone="danger" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[type.heading, { color: colors.text }]}>{c.name}</Text>
              <Text style={[type.caption, { color: colors.textMuted }]} selectable>
                {c.phone}
              </Text>
            </View>
          </View>
          {c.note ? <Text style={[type.body, { color: colors.textMuted }]}>{c.note}</Text> : null}
          <Button title={`Call ${c.name}`} icon="call" variant="danger" onPress={() => call(c)} />
        </Card>
      ))}
    </>
  );
}
