import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { ErrorState, IconBadge, Loading, NoFlatState, SectionTitle, useFocusLoad } from '@/components/resident';
import { reportError } from '@/lib/errors';
import { formatDate, formatPeriod, formatRupees } from '@/lib/format';
import { FlatSwitcher, useResidentFlat } from '@/lib/residentFlat';
import { screenState } from '@/lib/screenState';
import { billStatusPill } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { Banner, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { radius, shadow, space, type, useTheme } from '@/theme/tokens';

type Bill = Database['public']['Tables']['bills']['Row'];

/** Green summary card when nothing is due (same in light and dark: white text on it). */
const ALL_CLEAR = ['#22C55E', '#15803D'] as const;

export default function BillsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { flat, loading: flatLoading, error: flatError, reload } = useResidentFlat();
  const flatId = flat?.id ?? null;
  const [bills, setBills] = useState<Bill[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!flatId) return;
    const { data, error: err } = await supabase
      .from('bills')
      .select('*')
      .eq('flat_id', flatId)
      .order('period', { ascending: false })
      .limit(36);
    if (err) {
      setError(reportError(err));
      return false;
    }
    setError(null);
    setBills(data ?? []);
  }, [flatId]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load, !!flatId);
  const state = screenState({ loaded, error: error ?? loadFailure, needsFlat: true, flatLoading, hasFlat: !!flat });
  const today = new Date();
  const unpaid = bills.filter((b) => b.status === 'unpaid');
  const due = unpaid.reduce((sum, b) => sum + Number(b.amount), 0);
  const overdue = unpaid.filter((b) => billStatusPill(b.status, b.due_date, today).label === 'Overdue').length;

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline={flat?.label} title="Bills" subtitle="Maintenance bills and receipts" />
      <FlatSwitcher />
      {(error ?? loadFailure) && state === 'ready' ? <Banner text={(error ?? loadFailure) as string} /> : null}
      {state === 'no_flat' ? (
        <NoFlatState message={flatError} onRetry={reload} />
      ) : state === 'error' ? (
        <ErrorState message={error ?? loadFailure ?? ''} onRetry={onRefresh} />
      ) : state === 'loading' ? (
        <Loading />
      ) : bills.length ? (
        <>
          <LinearGradient
            colors={unpaid.length ? colors.hero : ALL_CLEAR}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[{ borderRadius: radius.lg, padding: space.xl, gap: space.xs }, shadow(2)]}>
            <Text style={[type.overline, { color: 'rgba(255,255,255,0.8)' }]}>
              {unpaid.length ? 'OUTSTANDING' : 'ALL CLEAR'}
            </Text>
            <Text style={[type.display, { color: '#fff' }]}>{formatRupees(due)}</Text>
            <Text style={[type.body, { color: 'rgba(255,255,255,0.9)' }]}>
              {unpaid.length
                ? `${unpaid.length} unpaid bill${unpaid.length > 1 ? 's' : ''}${overdue ? ` · ${overdue} overdue` : ''}. Pay at the society office.`
                : 'No dues. Thank you!'}
            </Text>
          </LinearGradient>
          <SectionTitle title="All bills" />
          {bills.map((b) => (
            <BillCard
              key={b.id}
              bill={b}
              today={today}
              onPress={() => router.push({ pathname: '/(resident)/bills/[id]', params: { id: b.id } })}
            />
          ))}
        </>
      ) : (
        <EmptyState icon="receipt-outline" title="No bills yet" message="Maintenance bills from the society will appear here." />
      )}
    </Screen>
  );
}

function BillCard({ bill, today, onPress }: { bill: Bill; today: Date; onPress: () => void }) {
  const { colors } = useTheme();
  const status = billStatusPill(bill.status, bill.due_date, today);
  return (
    <Card onPress={onPress} accessibilityLabel={`${formatPeriod(bill.period)} bill, ${formatRupees(Number(bill.amount))}, ${status.label}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconBadge icon={bill.status === 'paid' ? 'receipt' : 'wallet'} tone={status.tone} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]}>{formatPeriod(bill.period)}</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>
            {bill.status === 'paid' && bill.paid_at ? `Paid on ${formatDate(bill.paid_at)}` : `Due ${formatDate(bill.due_date)}`}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={[type.heading, { color: colors.text }]}>{formatRupees(Number(bill.amount))}</Text>
          <Pill label={status.label} tone={status.tone} icon={status.icon} />
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
      </View>
    </Card>
  );
}
