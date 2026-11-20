import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/lib/sessionContext';
import { ui } from '@/lib/ui';

// The app always opens at "/". Signed out → login. Signed in → spinner while the
// post-login bootstrap (root layout) decides the guard/resident home.
export default function Index() {
  const session = useSession();
  if (!session) return <Redirect href="/login" />;
  return (
    <View style={ui.screen}>
      <ActivityIndicator />
    </View>
  );
}
