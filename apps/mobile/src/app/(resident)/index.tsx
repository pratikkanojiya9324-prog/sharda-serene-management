import { Pressable, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { ui } from '@/lib/ui';

// Placeholder: the real resident screens are built in a later task.
export default function ResidentHome() {
  return (
    <View style={ui.screen}>
      <Text style={ui.title}>Resident home</Text>
      <Pressable style={ui.secondary} onPress={() => supabase.auth.signOut()}>
        <Text style={ui.secondaryText}>Sign out</Text>
      </Pressable>
    </View>
  );
}
