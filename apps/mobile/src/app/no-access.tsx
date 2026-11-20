import { Pressable, Text, View } from 'react-native';

import { signOut } from '@/lib/signOut';
import { ui } from '@/lib/ui';

export default function NoAccess() {
  return (
    <View style={ui.screen}>
      <Text style={ui.title}>No access in the app</Text>
      <Text style={ui.body}>
        Use the admin website at (admin site URL) to manage your society. If you expected to be a guard or
        resident, ask your admin to invite this number.
      </Text>
      <Pressable style={ui.secondary} onPress={() => signOut()}>
        <Text style={ui.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}
