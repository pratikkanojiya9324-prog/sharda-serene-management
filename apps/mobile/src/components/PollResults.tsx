import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import type { ResultBar } from '@/lib/polls';
import { radius, space, type, useTheme } from '@/theme/tokens';

/** Horizontal result bars with percentages; the viewer's own choice gets a check. */
export function PollResults({ bars, turnout }: { bars: ResultBar[]; turnout: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.md }}>
      {bars.map((b) => (
        <View
          key={b.id}
          style={{ gap: 6 }}
          accessible
          accessibilityLabel={`${b.label}, ${b.pct} percent, ${b.count} ${b.count === 1 ? 'vote' : 'votes'}${b.mine ? ', your flat chose this' : ''}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            {b.mine ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
            <Text style={[type.label, { color: colors.text, flex: 1 }]}>{b.label}</Text>
            <Text style={[type.label, { color: colors.textMuted }]}>{b.pct}%</Text>
          </View>
          <View style={{ height: 10, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted, overflow: 'hidden' }}>
            <View
              style={{
                width: `${b.pct}%`,
                height: '100%',
                borderRadius: radius.pill,
                backgroundColor: b.mine ? colors.primary : colors.info,
              }}
            />
          </View>
        </View>
      ))}
      <Text style={[type.caption, { color: colors.textMuted }]}>{turnout}</Text>
    </View>
  );
}
