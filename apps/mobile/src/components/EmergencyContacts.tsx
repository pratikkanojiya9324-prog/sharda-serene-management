import AsyncStorage from '@react-native-async-storage/async-storage';
import { EMERGENCY_CONTACT_SELECT } from '@society-gate/shared';
import { useState } from 'react';
import { Linking, Text, View } from 'react-native';

import { IconBadge } from '@/components/resident';
import { reportError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

export type Contact = { id: string; name: string; phone: string; note: string | null };

const CACHE_KEY = 'emergencyContacts';

/** The last list fetched successfully (works offline); empty if none. */
export async function loadCachedContacts(): Promise<Contact[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Contact[]) : [];
  } catch {
    return [];
  }
}

/**
 * The society's emergency numbers. Returns `error` text instead of throwing; on
 * failure the cached list (if any) is returned alongside the error.
 */
export async function fetchEmergencyContacts(): Promise<{ contacts: Contact[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('emergency_contacts')
      .select(EMERGENCY_CONTACT_SELECT)
      .order('sort_order')
      .order('created_at');
    if (error) return { contacts: await loadCachedContacts(), error: reportError(error) };
    const contacts = data ?? [];
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(contacts)).catch(() => {});
    return { contacts, error: null };
  } catch (e) {
    return { contacts: await loadCachedContacts(), error: reportError(e as { message?: string } | null) };
  }
}

const POLICE: Contact = { id: 'builtin-112', name: 'Police / Emergency 112', phone: '112', note: null };

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

  const all = contacts.some((c) => c.phone.replace(/\D/g, '') === '112') ? contacts : [...contacts, POLICE];
  return (
    <>
      {callError ? <Banner text={callError} /> : null}
      {all.map((c) => (
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
