import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { radius, shadow, space, toneColors, type, useTheme, type Tone } from './tokens';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ---------------------------------------------------------------------------
// Screen: safe-area page with the neutral background; optional scroll and
// pull-to-refresh (pass onRefresh + refreshing).
// ---------------------------------------------------------------------------
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'bottom'],
  refreshing,
  onRefresh,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const pad = padded ? { padding: space.xl } : null;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[{ flexGrow: 1, gap: space.lg }, pad, contentStyle]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              ) : undefined
            }>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <View style={[{ flex: 1, gap: space.lg }, pad, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Header: "plain" is a page title row (optional back button and right slot);
// "hero" is the teal gradient banner used on welcome-style screens.
// ---------------------------------------------------------------------------
export function Header({
  title,
  subtitle,
  overline,
  icon,
  onBack,
  right,
  variant = 'plain',
  children,
}: {
  title: string;
  subtitle?: string;
  overline?: string;
  icon?: IconName;
  onBack?: () => void;
  right?: ReactNode;
  variant?: 'plain' | 'hero';
  /** Extra content under the hero text (e.g. a loading indicator). */
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (variant === 'hero') {
    return (
      <LinearGradient
        colors={colors.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + space.lg }]}>
        <StatusBar style="light" />
        {/* Soft decorative rings */}
        <View pointerEvents="none" style={[styles.ring, { width: 260, height: 260, top: -90, right: -80 }]} />
        <View pointerEvents="none" style={[styles.ring, { width: 160, height: 160, bottom: -50, left: -40 }]} />
        <View pointerEvents="none" style={[styles.dot, { backgroundColor: colors.accent }]} />
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.heroBack, pressed && { opacity: 0.7 }]}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        ) : null}
        {icon ? (
          <View style={styles.heroIcon}>
            <Ionicons name={icon} size={28} color="#fff" />
          </View>
        ) : null}
        {overline ? <Text style={[type.overline, styles.heroOverline]}>{overline.toUpperCase()}</Text> : null}
        <Text style={[type.display, { color: '#fff' }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[type.body, styles.heroSubtitle]}>{subtitle}</Text> : null}
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={styles.headerRow}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [
            styles.iconButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        {overline ? <Text style={[type.overline, { color: colors.primary }]}>{overline.toUpperCase()}</Text> : null}
        <Text style={[type.title, { color: colors.text }]} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[type.caption, { color: colors.textMuted, marginTop: 2 }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const look = {
    primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary, border: 'transparent' },
    secondary: { bg: colors.surface, pressed: colors.surfaceMuted, fg: colors.primary, border: colors.border },
    ghost: { bg: 'transparent', pressed: colors.primarySoft, fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerSoft, pressed: colors.dangerSoft, fg: colors.danger, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? look.pressed : look.bg, borderColor: look.border },
        variant === 'primary' && !inactive ? shadow(1) : null,
        pressed && { transform: [{ scale: 0.98 }] },
        disabled && !loading && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={20} color={look.fg} /> : null}
          <Text style={[type.heading, { color: look.fg }]}>{title}</Text>
          {iconRight ? <Ionicons name={iconRight} size={20} color={look.fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------
export function Card({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const base = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow(1)];
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && { backgroundColor: colors.surfaceMuted }, style]}>
      {children}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Pill: status chip with colour + icon (e.g. Open / Paid / Approved)
// ---------------------------------------------------------------------------
export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const { colors } = useTheme();
  const { fg, bg } = toneColors(colors, tone);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={[type.caption, { color: fg, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Banner: inline message (errors, notices) with an icon.
// ---------------------------------------------------------------------------
export function Banner({ text, tone = 'danger', icon }: { text: string; tone?: Tone; icon?: IconName }) {
  const { colors } = useTheme();
  const { fg, bg } = toneColors(colors, tone);
  const fallback: IconName = tone === 'danger' ? 'alert-circle' : tone === 'success' ? 'checkmark-circle' : 'information-circle';
  return (
    <View style={[styles.banner, { backgroundColor: bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name={icon ?? fallback} size={20} color={fg} />
      <Text style={[type.label, { color: fg, flex: 1 }]}>{text}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// EmptyState: icon + one line of copy (+ optional action)
// ---------------------------------------------------------------------------
export function EmptyState({
  icon,
  title,
  message,
  action,
  tone = 'brand',
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
  tone?: Tone;
}) {
  const { colors } = useTheme();
  const { fg, bg } = toneColors(colors, tone);
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={34} color={fg} />
      </View>
      <Text style={[type.heading, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      {message ? (
        <Text style={[type.body, { color: colors.textMuted, textAlign: 'center' }]}>{message}</Text>
      ) : null}
      {action ? <View style={{ alignSelf: 'stretch', marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Input: labelled text field; `password` adds a show/hide toggle.
// ---------------------------------------------------------------------------
export function Input({
  label,
  error,
  icon,
  password = false,
  style,
  ...props
}: TextInputProps & { label?: string; error?: string | null; icon?: IconName; password?: boolean }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={[type.label, { color: colors.textMuted }]}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          { backgroundColor: colors.surface, borderColor },
          focused && { borderWidth: 2, paddingHorizontal: space.lg - 1 },
        ]}>
        {icon ? <Ionicons name={icon} size={20} color={focused ? colors.primary : colors.textSubtle} /> : null}
        <TextInput
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          {...props}
          secureTextEntry={password ? hidden : props.secureTextEntry}
          accessibilityLabel={props.accessibilityLabel ?? label}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={[styles.fieldText, type.body, { color: colors.text }, style]}
        />
        {password ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[type.caption, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Select: a field that opens a bottom sheet of options. `columns` lays short
// options (flat numbers) out as a grid of tiles.
// ---------------------------------------------------------------------------
export type SelectOption = { value: string; label: string; hint?: string };

export function Select({
  label,
  placeholder = 'Select',
  value,
  options,
  onChange,
  disabled = false,
  icon,
  columns = 1,
  sheetTitle,
  style,
}: {
  label: string;
  placeholder?: string;
  value: string | null;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  icon?: IconName;
  columns?: number;
  sheetTitle?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;
  const inactive = disabled || options.length === 0;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <View style={[{ gap: 6 }, style]}>
      <Text style={[type.label, { color: colors.textMuted }]}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={inactive}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? selected.label : placeholder}`}
        accessibilityState={{ disabled: inactive, expanded: open }}
        style={({ pressed }) => [
          styles.field,
          { backgroundColor: colors.surface, borderColor: open ? colors.primary : colors.border },
          pressed && { backgroundColor: colors.surfaceMuted },
          inactive && { opacity: 0.55 },
        ]}>
        {icon ? <Ionicons name={icon} size={20} color={selected ? colors.primary : colors.textSubtle} /> : null}
        <Text
          numberOfLines={1}
          style={[type.body, { flex: 1, color: selected ? colors.text : colors.textSubtle }, selected && { fontWeight: '600' }]}>
          {selected ? selected.label : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
            onPress={() => setOpen(false)}
            accessibilityLabel="Close"
          />
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, paddingBottom: insets.bottom + space.lg },
              shadow(2),
            ]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeader}>
              <Text style={[type.title, { color: colors.text, flex: 1 }]}>{sheetTitle ?? label}</Text>
              <Pressable
                onPress={() => setOpen(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={[styles.iconButton, { backgroundColor: colors.surfaceMuted, borderColor: 'transparent' }]}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              key={columns}
              numColumns={columns}
              keyExtractor={(o) => o.value}
              style={{ maxHeight: 440 }}
              contentContainerStyle={{ gap: space.sm, paddingBottom: space.sm }}
              columnWrapperStyle={columns > 1 ? { gap: space.sm } : undefined}
              renderItem={({ item }) => {
                const active = item.value === value;
                if (columns > 1) {
                  return (
                    <Pressable
                      onPress={() => pick(item.value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={({ pressed }) => [
                        styles.tile,
                        {
                          backgroundColor: active ? colors.primary : pressed ? colors.primarySoft : colors.surfaceMuted,
                          flexBasis: `${100 / columns - 3}%`,
                        },
                      ]}>
                      <Text style={[type.heading, { color: active ? colors.onPrimary : colors.text }]}>{item.label}</Text>
                    </Pressable>
                  );
                }
                return (
                  <Pressable
                    onPress={() => pick(item.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: active ? colors.primarySoft : pressed ? colors.surfaceMuted : 'transparent',
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[type.heading, { color: active ? colors.primary : colors.text }]}>{item.label}</Text>
                      {item.hint ? <Text style={[type.caption, { color: colors.textMuted }]}>{item.hint}</Text> : null}
                    </View>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={active ? colors.primary : colors.border}
                    />
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Avatar: initials in a soft brand circle (family members, staff).
// ---------------------------------------------------------------------------
export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: space.xl,
    paddingBottom: 72,
    gap: space.sm,
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 28,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5, top: 120, right: 48, opacity: 0.9 },
  heroBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  heroOverline: { color: 'rgba(255,255,255,0.75)' },
  heroSubtitle: { color: 'rgba(255,255,255,0.86)' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.sm,
  },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  field: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  fieldText: { flex: 1, paddingVertical: space.md },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.xl,
    paddingTop: space.sm,
    gap: space.md,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: space.xs },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  tile: { minHeight: 52, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
