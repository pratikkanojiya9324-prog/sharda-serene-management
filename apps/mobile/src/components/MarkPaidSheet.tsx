import Ionicons from '@expo/vector-icons/Ionicons';
import type { Database } from '@society-gate/shared';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_REFERENCE_LENGTH, validatePayment } from '@/lib/adminBills';
import { friendlyError } from '@/lib/errors';
import { formatPeriod, formatRupees } from '@/lib/format';
import { PAYMENT_MODE_LABEL } from '@/lib/status';
import { supabase } from '@/lib/supabase';
import { Banner, Button, Input, type IconName } from '@/theme/components';
import { radius, shadow, space, type, useTheme } from '@/theme/tokens';

type Bill = Database['public']['Tables']['bills']['Row'];
type PaymentMode = Database['public']['Enums']['payment_mode'];

const MODES: { value: PaymentMode; icon: IconName }[] = [
  { value: 'cash', icon: 'cash-outline' },
  { value: 'upi', icon: 'phone-portrait-outline' },
  { value: 'cheque', icon: 'document-text-outline' },
  { value: 'other', icon: 'card-outline' },
];

const REFERENCE_LABEL: Record<PaymentMode, string> = {
  cash: 'Note (optional)',
  upi: 'UPI transaction ID (optional)',
  cheque: 'Cheque number',
  other: 'Reference (optional)',
};

/**
 * Bottom sheet to record a payment for one bill: payment mode + reference,
 * then mark_bill_paid (which assigns the receipt number). Calls `onPaid`
 * with the updated bill.
 */
export function MarkPaidSheet({
  bill,
  labels,
  onClose,
  onPaid,
}: {
  bill: Bill | null;
  /** flat id → "B1-A-101" */
  labels: Map<string, string>;
  onClose: () => void;
  onPaid: (bill: Bill) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  // Keeps showing the last bill while the sheet slides away after closing.
  const [shown, setShown] = useState<Bill | null>(bill);

  // Fresh form for every bill.
  const billId = bill?.id;
  useEffect(() => {
    if (bill) setShown(bill);
    setMode(null);
    setReference('');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billId]);

  async function confirm() {
    if (!bill || inFlight.current) return;
    const check = validatePayment(mode, reference);
    if (!check.ok) return setError(check.error);
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc('mark_bill_paid', {
        p_bill_id: bill.id,
        p_mode: check.mode,
        ...(check.reference ? { p_reference: check.reference } : {}),
      });
      if (err || !data) return setError(friendlyError(err?.message ?? ''));
      onPaid(data);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal visible={!!bill} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={close} accessibilityLabel="Close" />
        {shown ? (
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg },
              shadow(2),
            ]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <View style={{ flex: 1 }}>
                <Text style={[type.overline, { color: colors.primary }]}>MARK PAID</Text>
                <Text style={[type.title, { color: colors.text }]}>{labels.get(shown.flat_id) ?? 'Flat'}</Text>
                <Text style={[type.caption, { color: colors.textMuted }]}>{formatPeriod(shown.period)} maintenance</Text>
              </View>
              <Text style={[type.title, { color: colors.text }]}>{formatRupees(Number(shown.amount))}</Text>
            </View>

            <Text style={[type.label, { color: colors.textMuted }]}>Paid by</Text>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              {MODES.map((m) => {
                const active = m.value === mode;
                return (
                  <Pressable
                    key={m.value}
                    onPress={() => {
                      setMode(m.value);
                      setError(null);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={PAYMENT_MODE_LABEL[m.value]}
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.mode,
                      {
                        borderColor: active ? colors.primary : colors.border,
                        borderWidth: active ? 2 : 1,
                        backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceMuted : colors.surface,
                      },
                    ]}>
                    <Ionicons name={m.icon} size={22} color={active ? colors.primary : colors.textMuted} />
                    <Text style={[type.label, { color: active ? colors.primary : colors.text }]}>
                      {PAYMENT_MODE_LABEL[m.value]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {mode ? (
              <Input
                label={REFERENCE_LABEL[mode]}
                placeholder={mode === 'cheque' ? 'e.g. 004512' : mode === 'upi' ? 'e.g. 4321 8765 0912' : ''}
                value={reference}
                onChangeText={setReference}
                maxLength={MAX_REFERENCE_LENGTH}
                autoCapitalize="characters"
                autoCorrect={false}
                icon="pricetag-outline"
              />
            ) : null}

            {error ? <Banner text={error} /> : null}
            <Button title="Confirm payment" icon="checkmark-circle" loading={busy} disabled={!mode} onPress={confirm} />
            <Button title="Cancel" variant="ghost" onPress={close} disabled={busy} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    gap: space.md,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: space.xs },
  mode: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
});
