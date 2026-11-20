import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { MarkPaidSheet } from '@/components/MarkPaidSheet';
import { Chips, IconBadge, Loading, useFocusLoad } from '@/components/resident';
import { filterBills, monthsBetween, summarizeBills, type BillFilter } from '@/lib/adminBills';
import { useAdminSociety } from '@/lib/adminSociety';
import { friendlyError } from '@/lib/errors';
import { fetchAll } from '@/lib/fetchAll';
import { flatLabels, loadFlatDirectory } from '@/lib/flatDirectory';
import { formatDate, formatPeriod, formatRupees } from '@/lib/format';
import { PAYMENT_MODE_LABEL, billStatusPill } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Input, Pill, Screen, Select } from '@/theme/components';
import { radius, shadow, space, type, useTheme } from '@/theme/tokens';

type Bill = Database['public']['Tables']['bills']['Row'];
type Row = Bill & { label: string };

export default function AdminBillsScreen() {
  const { colors } = useTheme();
  const { societyId, societyName, error: societyError } = useAdminSociety();
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState<string | null>(null);
  // `load` reads the chosen month from here so picking a month doesn't rebuild it.
  const monthRef = useRef<string | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [labels, setLabels] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<BillFilter>('unpaid');
  const [query, setQuery] = useState('');
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<Bill | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!societyId) return;
    // Month range from the newest and oldest bill, plus the flat labels.
    const [newest, oldest, flats] = await Promise.all([
      supabase.from('bills').select('period').eq('society_id', societyId).order('period', { ascending: false }).limit(1),
      supabase.from('bills').select('period').eq('society_id', societyId).order('period', { ascending: true }).limit(1),
      loadFlatDirectory(societyId),
    ]);
    const err = newest.error ?? oldest.error ?? flats.error;
    if (err) return setError(friendlyError(err.message));
    setLabels(flatLabels(flats.data));
    const hi = newest.data?.[0]?.period;
    const lo = oldest.data?.[0]?.period;
    const list = hi && lo ? monthsBetween(lo, hi) : [];
    setMonths(list);
    const target = monthRef.current && list.includes(monthRef.current) ? monthRef.current : (list[0] ?? null);
    monthRef.current = target;
    setMonth(target);
    if (!target) {
      setError(null);
      return setBills([]);
    }
    const b = await fetchAll<Bill>((from, to) =>
      supabase.from('bills').select('*').eq('society_id', societyId).eq('period', target).order('id').range(from, to),
    );
    if (b.error) return setError(friendlyError(b.error.message));
    setError(null);
    setBills(b.data);
  }, [societyId]);
  const { loaded, refreshing, onRefresh } = useFocusLoad(load, !!societyId);

  async function selectMonth(next: string) {
    if (next === monthRef.current) return;
    monthRef.current = next;
    setMonth(next);
    setReceipt(null);
    setSwitching(true);
    try {
      await load();
    } finally {
      setSwitching(false);
    }
  }

  const rows: Row[] = useMemo(() => bills.map((b) => ({ ...b, label: labels.get(b.flat_id) ?? '—' })), [bills, labels]);
  const summary = summarizeBills(rows);
  const shown = filterBills(rows, filter, query);
  const index = month ? months.indexOf(month) : -1;
  const today = new Date();

  function onPaid(updated: Bill) {
    setBills((cur) => cur.map((b) => (b.id === updated.id ? updated : b)));
    setReceipt(
      `${labels.get(updated.flat_id) ?? 'Bill'} marked paid${updated.receipt_no ? ` · receipt ${updated.receipt_no}` : ''}`,
    );
    setPaying(null);
  }

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header overline={societyName ?? 'Admin'} title="Bills" subtitle="Collect maintenance and issue receipts" />
      {societyError ? <Banner text={societyError} /> : null}
      {error ? <Banner text={error} /> : null}
      {!loaded ? (
        societyError ? null : <Loading />
      ) : !months.length ? (
        <EmptyState
          icon="receipt-outline"
          title="No bills yet"
          message="Generate this month's bills from the admin website; they will show up here."
        />
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
            <StepButton
              icon="chevron-back"
              label="Older month"
              disabled={switching || index < 0 || index >= months.length - 1}
              onPress={() => selectMonth(months[index + 1])}
            />
            <Select
              label="Month"
              value={month}
              options={months.map((m) => ({ value: m, label: formatPeriod(m) }))}
              onChange={selectMonth}
              icon="calendar-outline"
              sheetTitle="Choose a month"
              style={{ flex: 1 }}
            />
            <StepButton
              icon="chevron-forward"
              label="Newer month"
              disabled={switching || index <= 0}
              onPress={() => selectMonth(months[index - 1])}
            />
          </View>

          <LinearGradient
            colors={colors.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[{ borderRadius: radius.lg, padding: space.xl, gap: space.sm }, shadow(2)]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[type.overline, { color: 'rgba(255,255,255,0.8)', flex: 1 }]}>
                {month ? formatPeriod(month).toUpperCase() : ''} · COLLECTED
              </Text>
              {switching ? <ActivityIndicator color="#fff" /> : null}
            </View>
            <Text style={[type.display, { color: '#fff' }]}>{formatRupees(summary.collected)}</Text>
            <Text style={[type.body, { color: 'rgba(255,255,255,0.9)' }]}>
              of {formatRupees(summary.billed)} · {summary.paid}/{summary.count} flats paid
            </Text>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' }}>
              <View
                style={{
                  height: 8,
                  borderRadius: 4,
                  width: `${summary.billed ? Math.round((summary.collected / summary.billed) * 100) : 0}%`,
                  backgroundColor: colors.accent,
                }}
              />
            </View>
            {summary.unpaid ? (
              <Text style={[type.label, { color: '#fff' }]}>
                {formatRupees(summary.outstanding)} outstanding from {summary.unpaid} flat{summary.unpaid > 1 ? 's' : ''}
              </Text>
            ) : summary.count ? (
              <Text style={[type.label, { color: '#fff' }]}>Every flat has paid. Well done!</Text>
            ) : null}
          </LinearGradient>

          {receipt ? <Banner text={receipt} tone="success" icon="receipt" /> : null}

          <Chips
            options={[
              { value: 'unpaid', label: `Unpaid · ${summary.unpaid}` },
              { value: 'paid', label: `Paid · ${summary.paid}` },
              { value: 'all', label: 'All' },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <Input
            placeholder="Search flat, e.g. B1-A-101"
            value={query}
            onChangeText={setQuery}
            icon="search"
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Search flat"
          />

          {shown.length ? (
            shown.map((b) => <BillRow key={b.id} bill={b} today={today} onMarkPaid={() => setPaying(b)} />)
          ) : (
            <EmptyState
              icon={filter === 'unpaid' && !query ? 'checkmark-done-outline' : 'search-outline'}
              tone={filter === 'unpaid' && !query ? 'success' : 'neutral'}
              title={
                query
                  ? 'No flat matches'
                  : filter === 'unpaid'
                    ? 'No unpaid bills'
                    : filter === 'paid'
                      ? 'No payments yet'
                      : 'No bills this month'
              }
            />
          )}
        </>
      )}
      <MarkPaidSheet bill={paying} labels={labels} onClose={() => setPaying(null)} onPaid={onPaid} />
    </Screen>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 54,
        height: 54,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
        opacity: disabled ? 0.4 : 1,
      })}>
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

function BillRow({ bill, today, onMarkPaid }: { bill: Row; today: Date; onMarkPaid: () => void }) {
  const { colors } = useTheme();
  const status = billStatusPill(bill.status, bill.due_date, today);
  const paid = bill.status === 'paid';
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <IconBadge icon={paid ? 'receipt' : 'home'} tone={status.tone} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[type.heading, { color: colors.text }]}>{bill.label}</Text>
          <Text style={[type.caption, { color: colors.textMuted }]} numberOfLines={2}>
            {paid
              ? [
                  bill.paid_at ? `Paid ${formatDate(bill.paid_at)}` : 'Paid',
                  bill.payment_mode ? PAYMENT_MODE_LABEL[bill.payment_mode] : null,
                  bill.payment_reference,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : `Due ${formatDate(bill.due_date)}`}
          </Text>
          {paid && bill.receipt_no ? (
            <Text style={[type.caption, { color: colors.primary, fontWeight: '700' }]} selectable>
              {bill.receipt_no}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={[type.heading, { color: colors.text }]}>{formatRupees(Number(bill.amount))}</Text>
          <Pill label={status.label} tone={status.tone} icon={status.icon} />
        </View>
      </View>
      {!paid ? (
        <Button
          title="Mark paid"
          icon="checkmark-circle-outline"
          variant="secondary"
          onPress={onMarkPaid}
          style={{ minHeight: 44 }}
        />
      ) : null}
    </Card>
  );
}
