import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import type { IconName } from '@/theme/components';
import { radius, space, toneColors, type, useTheme, type Tone } from '@/theme/tokens';

// Small building blocks shared by the resident screens (on top of the theme
// components): toned icon badges, section titles, filter chips, a centred
// loader and a focus-aware load/refresh hook.

/** Rounded square with a toned icon, used at the start of list cards. */
export function IconBadge({ icon, tone = 'brand', size = 44 }: { icon: IconName; tone?: Tone; size?: number }) {
  const { colors } = useTheme();
  const { fg, bg } = toneColors(colors, tone);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name={icon} size={size * 0.5} color={fg} />
    </View>
  );
}

/** Section heading with an optional count bubble and right-hand action. */
export function SectionTitle({ title, count, right }: { title: string; count?: number; right?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
      <Text style={[type.heading, { color: colors.text }]}>{title}</Text>
      {count ? (
        <View style={{ backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 8, minWidth: 22 }}>
          <Text style={[type.caption, { color: '#fff', fontWeight: '800', textAlign: 'center' }]}>{count}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

/** Horizontal filter chips (All / Open / ...). */
export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => ({
              paddingHorizontal: space.lg,
              paddingVertical: space.sm,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primary : pressed ? colors.surfaceMuted : colors.surface,
            })}>
            <Text style={[type.label, { color: active ? colors.onPrimary : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small "label: value" row for detail cards (receipts, complaint info). */
export function InfoRow({ label, value, icon }: { label: string; value: string; icon?: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {icon ? <Ionicons name={icon} size={18} color={colors.textSubtle} /> : null}
      <Text style={[type.body, { color: colors.textMuted, flex: 1 }]}>{label}</Text>
      <Text style={[type.body, { color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }]} selectable>
        {value}
      </Text>
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ paddingVertical: space.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

/**
 * Runs `load` whenever the screen gains focus and exposes pull-to-refresh
 * state. `loaded` turns true after the first load finishes (success or not).
 * Pass `ready = false` while an input is missing (e.g. the flat is still
 * loading) so the screen keeps its spinner instead of an empty state.
 */
export function useFocusLoad(load: () => Promise<void>, ready = true) {
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!ready) return;
      let active = true;
      load().finally(() => {
        if (active) setLoaded(true);
      });
      return () => {
        active = false;
      };
    }, [load, ready]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return { loaded, refreshing, onRefresh };
}
