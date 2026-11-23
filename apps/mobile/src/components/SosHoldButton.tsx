import Ionicons from '@expo/vector-icons/Ionicons';
import { SOS_TYPES, type SosType } from '@society-gate/shared';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SOS_HOLD_MS, sosTypeIcon } from '@/lib/sos';
import { radius, space, type, useTheme } from '@/theme/tokens';

const SIZE = 120;

/**
 * Hold for 2 s to fire `onComplete`; the red disc fills while held and
 * resets if released early. Screen-reader users get an "activate" action
 * (a long press is not possible for them).
 */
export function SosHoldButton({ onComplete, disabled = false }: { onComplete: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const [holding, setHolding] = useState(false);
  const running = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => () => running.current?.stop(), []);

  function start() {
    if (disabled) return;
    setHolding(true);
    progress.setValue(0);
    running.current = Animated.timing(progress, {
      toValue: 1,
      duration: SOS_HOLD_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    running.current.start(({ finished }) => {
      if (finished) {
        setHolding(false);
        progress.setValue(0);
        onComplete();
      }
    });
  }

  function cancel() {
    running.current?.stop();
    running.current = null;
    setHolding(false);
    progress.setValue(0);
  }

  return (
    <View style={{ alignItems: 'center', gap: space.sm }}>
      <Pressable
        onPressIn={start}
        onPressOut={cancel}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="SOS emergency"
        accessibilityHint="Press and hold for 2 seconds to send an emergency alert to the guards"
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => {
          if (!disabled) onComplete();
        }}
        style={{
          width: SIZE,
          height: SIZE,
          borderRadius: SIZE / 2,
          backgroundColor: colors.dangerSoft,
          borderWidth: 4,
          borderColor: colors.danger,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            backgroundColor: colors.danger,
            transform: [{ scale: progress }],
          }}
        />
        <Ionicons name="alert-circle" size={40} color={holding ? '#FFFFFF' : colors.danger} />
        <Text style={[type.heading, { color: holding ? '#FFFFFF' : colors.danger }]}>SOS</Text>
      </Pressable>
      <Text style={[type.caption, { color: colors.textMuted }]}>{holding ? 'Keep holding…' : 'Hold for 2 seconds'}</Text>
    </View>
  );
}

/** Bottom sheet shown after the hold: one tap on a type sends the SOS. */
export function SosTypeSheet({
  visible,
  onPick,
  onClose,
}: {
  visible: boolean;
  onPick: (t: SosType) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            paddingHorizontal: space.xl,
            paddingTop: space.lg,
            paddingBottom: insets.bottom + space.lg,
            gap: space.md,
          }}>
          <Text style={[type.title, { color: colors.danger }]}>What is the emergency?</Text>
          <Text style={[type.caption, { color: colors.textMuted }]}>Tap one to alert the guards and the office now.</Text>
          {SOS_TYPES.map((t) => (
            <Pressable
              key={t.value}
              onPress={() => onPick(t.value)}
              accessibilityRole="button"
              accessibilityLabel={`${t.label} emergency`}
              style={({ pressed }) => ({
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                paddingHorizontal: space.lg,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.dangerSoft : colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.danger,
              })}>
              <Ionicons name={sosTypeIcon(t.value)} size={24} color={colors.danger} />
              <Text style={[type.heading, { color: colors.danger }]}>{t.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={onClose} accessibilityRole="button" style={{ alignItems: 'center', padding: space.md }}>
            <Text style={[type.label, { color: colors.textMuted }]}>Not an emergency, go back</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
