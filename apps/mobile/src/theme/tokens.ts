import { Platform, useColorScheme, type ViewStyle } from 'react-native';

// Society Gate visual language: deep teal brand, warm amber accent, soft neutral
// surfaces, rounded 16 corners, soft shadows. Light and dark palettes share keys.

export const brand = {
  teal: '#0F766E',
  tealDark: '#115E59',
  tealDeep: '#134E4A',
  amber: '#F59E0B',
} as const;

export type Palette = {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  accentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  /** Gradient stops for hero headers. */
  hero: readonly [string, string, string];
};

const light: Palette = {
  background: '#F4F7F6',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF3F2',
  border: '#DDE5E3',
  text: '#0F1F1D',
  textMuted: '#52615E',
  textSubtle: '#8A9794',
  primary: brand.teal,
  primaryPressed: brand.tealDark,
  primarySoft: '#E0F2EF',
  onPrimary: '#FFFFFF',
  accent: brand.amber,
  accentSoft: '#FEF3C7',
  success: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  info: '#1D4ED8',
  infoSoft: '#DBEAFE',
  overlay: 'rgba(15, 31, 29, 0.45)',
  hero: ['#14B8A6', brand.teal, brand.tealDeep],
};

const dark: Palette = {
  background: '#0B1513',
  surface: '#13211F',
  surfaceMuted: '#1A2B28',
  border: '#24403B',
  text: '#E8F1EF',
  textMuted: '#A3B5B1',
  textSubtle: '#6F8580',
  primary: '#14B8A6',
  primaryPressed: '#0D9488',
  primarySoft: '#123B36',
  onPrimary: '#04201C',
  accent: '#FBBF24',
  accentSoft: '#3A2C0B',
  success: '#4ADE80',
  successSoft: '#12301E',
  warning: '#FBBF24',
  warningSoft: '#3A2C0B',
  danger: '#F87171',
  dangerSoft: '#3B1414',
  info: '#93C5FD',
  infoSoft: '#172A4A',
  overlay: 'rgba(0, 0, 0, 0.6)',
  hero: ['#0F766E', '#115E59', '#0B2F2C'],
};

export const palettes = { light, dark } as const;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  label: { fontSize: 14, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '700' as const, letterSpacing: 1.2 },
};

/** Soft card shadow (iOS shadow / Android elevation). */
export function shadow(level: 1 | 2 = 1): ViewStyle {
  return Platform.select<ViewStyle>({
    android: { elevation: level === 1 ? 2 : 6 },
    default: {
      shadowColor: '#0F2A27',
      shadowOpacity: level === 1 ? 0.06 : 0.12,
      shadowRadius: level === 1 ? 10 : 20,
      shadowOffset: { width: 0, height: level === 1 ? 4 : 10 },
    },
  });
}

export type Theme = { dark: boolean; colors: Palette };

/** The current palette, following the phone's light/dark setting. */
export function useTheme(): Theme {
  const dark = useColorScheme() === 'dark';
  return { dark, colors: dark ? palettes.dark : palettes.light };
}

/** Status tones for pills, banners and icon badges. */
export type Tone = 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export function toneColors(colors: Palette, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'brand':
      return { fg: colors.primary, bg: colors.primarySoft };
    case 'accent':
      return { fg: colors.warning, bg: colors.accentSoft };
    case 'success':
      return { fg: colors.success, bg: colors.successSoft };
    case 'warning':
      return { fg: colors.warning, bg: colors.warningSoft };
    case 'danger':
      return { fg: colors.danger, bg: colors.dangerSoft };
    case 'info':
      return { fg: colors.info, bg: colors.infoSoft };
    default:
      return { fg: colors.textMuted, bg: colors.surfaceMuted };
  }
}
