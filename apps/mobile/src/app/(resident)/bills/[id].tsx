import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, Text, View } from 'react-native';

import { InfoRow, Loading, useFocusLoad } from '@/components/resident';
import { friendlyError } from '@/lib/errors';
import { formatDate, formatDateTime, formatPeriod, formatRupees } from '@/lib/format';
import { useResidentFlat } from '@/lib/residentFlat';
import { billStatusPill, PAYMENT_MODE_LABEL } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Card, EmptyState, Header, Pill, Screen } from '@/theme/components';
import { radius, space, toneColors, type, useTheme } from '@/theme/tokens';

type Bill = Database['public']['Tables']['bills']['Row'];

/** A bill; once paid it reads as the receipt. */
export default function BillScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { flat } = useResidentFlat();
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('bills').select('*').eq('id', id).maybeSingle();
    if (err) setError(friendlyError(err.message));
    else {
      setError(null);
      setBill(data);
    }
  }, [id]);
  const { loaded, refreshing, onRefresh, error: loadFailure } = useFocusLoad(load);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/(resident)/bills'));

  if (!loaded || !bill) {
    return (
      <Screen edges={['top']}>
        <Header title="Bill" onBack={back} />
        {!loaded ? loadFailure ? <Banner text={loadFailure} /> : <Loading /> : error ? <Banner text={error} /> : <EmptyState icon="receipt-outline" title="Bill not found" />}
      </Screen>
    );
  }

  const paid = bill.status === 'paid';
  const status = billStatusPill(bill.status, bill.due_date);
  const tone = toneColors(colors, status.tone);
  const amount = formatRupees(Number(bill.amount));
  const period = formatPeriod(bill.period);

  const shareReceipt = () =>
    Share.share({
      message: [
        `Receipt ${bill.receipt_no ?? ''}`.trim(),
        `Maintenance for ${period}${flat ? ` · Flat ${flat.label}` : ''}`,
        `Amount: ${amount}`,
        bill.paid_at ? `Paid on ${formatDate(bill.paid_at)}` : '',
        bill.payment_mode ? `Mode: ${PAYMENT_MODE_LABEL[bill.payment_mode]}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });

  return (
    <Screen scroll edges={['top']} refreshing={refreshing} onRefresh={onRefresh}>
      <Header title={paid ? 'Receipt' : 'Bill'} subtitle={period} onBack={back} />
      {error ? <Banner text={error} /> : null}

      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        <View style={{ backgroundColor: tone.bg, alignItems: 'center', padding: space.xl, gap: space.sm }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name={status.icon} size={36} color={tone.fg} />
          </View>
          <Text style={[type.display, { color: colors.text }]}>{amount}</Text>
          <Pill label={status.label} tone={status.tone} icon={status.icon} />
        </View>

        {/* Perforated edge between the summary and the details */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.sm, marginTop: -1 }}>
          {Array.from({ length: 18 }, (_, i) => (
            <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.background, marginTop: -4 }} />
          ))}
        </View>

        <View style={{ padding: space.xl, gap: space.md }}>
          {paid && bill.receipt_no ? (
            <View style={{ alignItems: 'center', gap: 2, marginBottom: space.sm }}>
              <Text style={[type.overline, { color: colors.textSubtle }]}>RECEIPT NO.</Text>
              <Text style={[type.title, { color: colors.text, letterSpacing: 1 }]} selectable>
                {bill.receipt_no}
              </Text>
            </View>
          ) : null}
          {flat ? <InfoRow icon="home-outline" label="Flat" value={flat.label} /> : null}
          <InfoRow icon="calendar-outline" label="Period" value={period} />
          <InfoRow icon="alarm-outline" label="Due date" value={formatDate(bill.due_date)} />
          {paid ? (
            <>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.xs }} />
              {bill.paid_at ? <InfoRow icon="checkmark-done-outline" label="Paid on" value={formatDateTime(bill.paid_at)} /> : null}
              {bill.payment_mode ? (
                <InfoRow icon="card-outline" label="Payment mode" value={PAYMENT_MODE_LABEL[bill.payment_mode]} />
              ) : null}
              {bill.payment_reference ? (
                <InfoRow icon="document-text-outline" label="Reference" value={bill.payment_reference} />
              ) : null}
            </>
          ) : null}
        </View>
      </Card>

      {paid ? (
        <Button title="Share receipt" icon="share-social-outline" variant="secondary" onPress={shareReceipt} />
      ) : (
        <View
          style={{
            flexDirection: 'row',
            gap: space.md,
            padding: space.lg,
            borderRadius: radius.md,
            backgroundColor: colors.infoSoft,
          }}>
          <Ionicons name="information-circle" size={22} color={colors.info} />
          <Text style={[type.body, { color: colors.info, flex: 1 }]}>
            Pay at the society office (cash, cheque or UPI). Your receipt appears here once the office records the payment.
          </Text>
        </View>
      )}
    </Screen>
  );
}
