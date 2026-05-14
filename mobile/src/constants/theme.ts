/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#E8EFFC',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#DCE7FB',
    textSecondary: '#404A5C',
  },
  dark: {
    text: '#F4F4F5',
    background: '#302C47',
    backgroundElement: '#19191C',
    backgroundSelected: '#333447',
    textSecondary: '#C9CCD6',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const Neo = {
  background: '#E8EFFC',
  surface: '#FFFFFF',
  muted: '#DCE7FB',
  foreground: '#000000',
  mutedForeground: '#404A5C',
  main: '#7EA6FF',
  success: '#CFF47A',
  warning: '#FFE66D',
  destructive: '#000000',
  destructiveForeground: '#FFFFFF',
  border: '#000000',
  radius: 6,
  borderWidth: 2,
  shadowOffset: 4,
} as const;

export const NeoShadow = {
  shadowColor: Neo.border,
  shadowOffset: { width: Neo.shadowOffset, height: Neo.shadowOffset },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: 4,
} as const;
