import type { Database } from '@society-gate/shared';
import { Text, View } from 'react-native';

import { formatDateTime, formatTime, timeAgo } from '@/lib/format';
import { VISIT_PURPOSE, visitPill } from '@/lib/status';
import { Card, Pill } from '@/theme/components';
import { space, type, useTheme } from '@/theme/tokens';

import { IconBadge } from './resident';

type Visit = Database['public']['Tables']['visits']['Row'];

/** Visitor card for Home and History: purpose icon, name, when, status pill. */
export function VisitRow({ visit, onPress, detailed = false }: { visit: Visit; onPress: () => void; detailed?: boolean }) {
  const { colors } = useTheme();
  const purpose = VISIT_PURPOSE[visit.purpose];
  const status = visitPill(visit);
  return (
    <Card onPress={onPress} accessibilityLabel={`${visit.name}, ${status.label}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconBadge icon={purpose.icon} tone="neutral" />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[type.heading, { color: colors.text }]} numberOfLines={1}>
            {visit.name}
          </Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {visit.pass_id ? 'Guest pass' : purpose.label} ·{' '}
            {detailed ? formatDateTime(visit.created_at) : timeAgo(visit.created_at)}
          </Text>
          {detailed && visit.entry_at ? (
            <Text style={[type.caption, { color: colors.textSubtle }]}>
              In {formatTime(visit.entry_at)}
              {visit.exit_at ? ` · Out ${formatTime(visit.exit_at)}` : ''}
            </Text>
          ) : null}
        </View>
        <Pill label={status.label} tone={status.tone} icon={status.icon} />
      </View>
    </Card>
  );
}
