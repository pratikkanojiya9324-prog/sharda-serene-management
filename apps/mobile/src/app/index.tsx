import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useSession } from '@/lib/sessionContext';
import { useTheme } from '@/theme/tokens';

// The app always opens at "/". Signed out → welcome (flat login). Signed in →
// spinner while the post-login bootstrap (root layout) decides the home.
export default function Index() {
  const session = useSession();
  const { colors } = useTheme();
  if (!session) return <Redirect href="/welcome" />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}
