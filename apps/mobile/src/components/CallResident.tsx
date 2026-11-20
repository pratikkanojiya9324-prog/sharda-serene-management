import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { formatPhone } from '@/lib/format';
import { guardErrorText } from '@/lib/guardErrors';
import { supabase } from '@/lib/supabase';
import { Avatar, Banner, Card } from '@/theme/components';
import { space, toneColors, type, useTheme } from '@/theme/tokens';

/** A family member with a phone, from `flat_contacts` (relation may be blank). */
type Contact = { name: string; phone: string; relation: string | null };

type Props = {
  flatId: string;
  visible: boolean;
  /** True when no resident of the flat has the app (no push could have reached anyone). */
  noAppUsers?: boolean;
};

export function CallResident({ flatId, visible, noAppUsers = false }: Props) {
  const { colors } = useTheme();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    supabase.rpc('flat_contacts', { p_flat_id: flatId }).then(({ data, error: err }) => {
      if (!active) return;
      if (err) setError(guardErrorText(err.message));
      else setContacts(data ?? []);
    });
    return () => {
      active = false;
    };
  }, [flatId, visible]);

  if (!visible) return null;
  const warn = toneColors(colors, 'accent');

  return (
    <Card style={{ borderColor: colors.accent, borderWidth: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Ionicons name="call" size={18} color={warn.fg} />
        <Text style={[type.heading, { color: colors.text, flex: 1 }]}>
          {noAppUsers ? 'No one in this flat uses the app — call them' : 'No response yet — call the resident'}
        </Text>
      </View>
      {error ? <Banner text={error} /> : null}
      {contacts?.length === 0 ? (
        <Text style={[type.body, { color: colors.textMuted }]}>No phone numbers saved for this flat</Text>
      ) : null}
      {contacts?.map((c) => (
        <View key={`${c.phone}-${c.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={c.name} size={40} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={[type.caption, { color: colors.textMuted }]}>
              {c.relation?.trim() ? `${c.relation.trim()} · ${formatPhone(c.phone)}` : formatPhone(c.phone)}
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL('tel:' + c.phone)}
            accessibilityRole="button"
            accessibilityLabel={`Call ${c.name}`}
            hitSlop={8}
            style={({ pressed }) => ({
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
            })}>
            <Ionicons name="call" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
      ))}
    </Card>
  );
}
