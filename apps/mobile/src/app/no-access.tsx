import { Linking, Pressable, Text, View } from 'react-native';

import { signOut } from '@/lib/signOut';
import { ui } from '@/lib/ui';

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL;
const WHERE = ADMIN_URL ? `the admin website at ${ADMIN_URL}` : "your society's admin website";

export default function NoAccess() {
  return (
    <View style={ui.screen}>
      <Text style={ui.title}>No access in the app</Text>
      <Text style={ui.body}>
        Use {WHERE} to manage your society. If you expected to be a guard or resident, ask your admin to invite
        this number.
      </Text>
      {ADMIN_URL ? (
        <Pressable style={ui.button} onPress={() => Linking.openURL(ADMIN_URL)}>
          <Text style={ui.buttonText}>Open admin website</Text>
        </Pressable>
      ) : null}
      <Pressable style={ui.secondary} onPress={() => signOut()}>
        <Text style={ui.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}
