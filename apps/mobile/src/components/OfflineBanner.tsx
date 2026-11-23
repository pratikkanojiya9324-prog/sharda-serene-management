import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsOnline } from '@/lib/network';
import { space, toneColors, type, useTheme } from '@/theme/tokens';

/** Thin strip at the top of every screen while the phone has no internet. */
export function OfflineBanner() {
  const online = useIsOnline();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  if (online) return null;
  const { fg, bg } = toneColors(colors, 'warning');
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + space.xs,
        paddingBottom: space.xs,
        paddingHorizontal: space.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.sm,
        backgroundColor: bg,
      }}>
      <Ionicons name="cloud-offline-outline" size={16} color={fg} />
      <Text style={[type.caption, { color: fg, fontWeight: '700' }]}>No internet — showing saved data</Text>
    </View>
  );
}
