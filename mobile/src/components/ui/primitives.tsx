import type { PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Neo, NeoShadow, Spacing } from '@/constants/theme';

type ButtonVariant = 'default' | 'destructive' | 'ghost' | 'outline' | 'secondary';

type ButtonProps = PropsWithChildren<{
  accessibilityLabel?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  testID?: string;
  variant?: ButtonVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}>;

type SegmentOption<TValue extends string> = {
  label: string;
  value: TValue;
  disabled?: boolean;
  testID?: string;
};

const stackScreenEdges: Edge[] = ['top', 'right', 'bottom', 'left'];
const tabScreenEdges: Edge[] = ['top', 'right', 'left'];

export function Screen({
  children,
  padded = true,
  testID,
  withinTabs = false,
}: PropsWithChildren<{ padded?: boolean; testID?: string; withinTabs?: boolean }>) {
  return (
    <SafeAreaView edges={withinTabs ? tabScreenEdges : stackScreenEdges} style={styles.safeArea} testID={testID}>
      <ScrollView
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.screenContent,
          withinTabs && styles.screenContentWithinTabs,
          !padded && styles.screenContentFlush,
        ]}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function LoadingState({
  message = 'Загружаем...',
  withinTabs = false,
}: {
  message?: string;
  withinTabs?: boolean;
}) {
  return (
    <SafeAreaView edges={withinTabs ? tabScreenEdges : stackScreenEdges} style={styles.centered}>
      <Card style={styles.centerCard}>
        <ActivityIndicator color={Neo.foreground} />
        <ThemedText type="smallBold">{message}</ThemedText>
      </Card>
    </SafeAreaView>
  );
}

export function ScreenHeader({
  action,
  eyebrow,
  leading,
  title,
  description,
}: {
  action?: ReactNode;
  eyebrow?: string;
  leading?: ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {leading ?? (eyebrow ? <Badge variant="outline">{eyebrow}</Badge> : null)}
        <ThemedText type="subtitle" style={styles.headerTitle}>
          {title}
        </ThemedText>
        {description ? (
          <ThemedText type="small" themeColor="textSecondary">
            {description}
          </ThemedText>
        ) : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export function BackButton({
  label = 'Назад',
  onPress,
  testID,
}: {
  label?: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      testID={testID}
      onPress={onPress}>
      <ThemedText type="smallBold" style={styles.backButtonText}>
        ← {label}
      </ThemedText>
    </Pressable>
  );
}

export function Card({
  children,
  style,
  testID,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle>; testID?: string }>) {
  return (
    <View style={[styles.card, style]} testID={testID}>
      {children}
    </View>
  );
}

export function Button({
  accessibilityLabel,
  children,
  disabled = false,
  fullWidth = false,
  onPress,
  style,
  testID,
  variant = 'default',
}: ButtonProps) {
  const isDark = variant === 'destructive';
  const isGhost = variant === 'ghost';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        pressed && !disabled && !isGhost && styles.pressed,
        style,
      ]}
      onPress={onPress}>
      <ThemedText
        type="smallBold"
        style={[
          styles.buttonText,
          isDark && styles.buttonTextDark,
          isGhost && styles.buttonTextGhost,
        ]}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

export function Badge({
  children,
  variant = 'default',
}: PropsWithChildren<{ variant?: 'default' | 'outline' | 'secondary' | 'success' | 'warning' }>) {
  return (
    <View style={[styles.badge, styles[`badge_${variant}`]]}>
      <ThemedText type="smallBold" style={styles.badgeText}>
        {children}
      </ThemedText>
    </View>
  );
}

export function AlertBox({
  description,
  title,
  variant = 'default',
}: {
  description?: string;
  title: string;
  variant?: 'default' | 'destructive' | 'warning';
}) {
  const destructive = variant === 'destructive';

  return (
    <View style={[styles.alert, styles[`alert_${variant}`]]}>
      <ThemedText type="smallBold" style={destructive && styles.alertDestructiveText}>
        {title}
      </ThemedText>
      {description ? (
        <ThemedText
          type="small"
          style={destructive && styles.alertDestructiveText}
          themeColor={destructive ? undefined : 'textSecondary'}>
          {description}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card style={styles.empty}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {description}
      </ThemedText>
      {action}
    </Card>
  );
}

export function Field({
  children,
  error,
  label,
}: PropsWithChildren<{ error?: string | null; label: string }>) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
      {error ? <ThemedText style={styles.fieldError}>{error}</ThemedText> : null}
    </View>
  );
}

export function TextField({
  autoCapitalize,
  autoCorrect,
  disabled = false,
  error,
  keyboardType,
  label,
  multiline = false,
  onBlur,
  onChangeText,
  placeholder,
  secureTextEntry,
  testID,
  textContentType,
  value,
}: {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: TextInputProps['autoCorrect'];
  disabled?: boolean;
  error?: string | null;
  keyboardType?: KeyboardTypeOptions;
  label: string;
  multiline?: boolean;
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: TextInputProps['secureTextEntry'];
  testID?: string;
  textContentType?: TextInputProps['textContentType'];
  value: string;
}) {
  return (
    <Field error={error} label={label}>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        editable={!disabled}
        keyboardType={keyboardType}
        multiline={multiline}
        onBlur={onBlur}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Neo.mutedForeground}
        secureTextEntry={secureTextEntry}
        style={[styles.input, multiline && styles.textArea, disabled && styles.disabled]}
        testID={testID}
        textContentType={textContentType}
        value={value}
      />
    </Field>
  );
}

export function SegmentedControl<TValue extends string>({
  accessibilityLabel,
  disabled = false,
  onChange,
  options,
  value,
}: {
  accessibilityLabel?: string;
  disabled?: boolean;
  onChange: (value: TValue) => void;
  options: SegmentOption<TValue>[];
  value: TValue;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;

        return (
          <Pressable
            accessibilityRole="button"
            disabled={disabled || option.disabled}
            key={option.value}
            testID={option.testID}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(option.value)}>
            <ThemedText type="smallBold">{option.label}</ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CheckboxRow({
  checked,
  disabled = false,
  label,
  onChange,
  testID,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  testID?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      style={[styles.checkboxRow, disabled && styles.disabled]}
      testID={testID}
      onPress={() => onChange(!checked)}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <ThemedText type="smallBold">✓</ThemedText> : null}
      </View>
      <ThemedText type="smallBold" style={styles.checkboxLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function ErrorText({ children }: PropsWithChildren) {
  return <ThemedText style={styles.fieldError}>{children}</ThemedText>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Neo.background,
  },
  screenContent: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.five,
  },
  screenContentWithinTabs: {
    paddingBottom: Spacing.three,
  },
  screenContentFlush: {
    paddingHorizontal: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Neo.background,
    padding: Spacing.three,
  },
  centerCard: {
    alignItems: 'center',
    minWidth: 220,
  },
  header: {
    flexDirection: 'row',
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: Spacing.two,
  },
  headerTitle: {
    lineHeight: 38,
  },
  headerAction: {
    alignItems: 'flex-end',
  },
  backButton: {
    minHeight: 40,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.surface,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    ...NeoShadow,
  },
  backButtonText: {
    color: Neo.foreground,
  },
  card: {
    gap: Spacing.three,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.surface,
    padding: Spacing.three,
    ...NeoShadow,
  },
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    ...NeoShadow,
  },
  button_default: {
    backgroundColor: Neo.main,
  },
  button_secondary: {
    backgroundColor: Neo.muted,
  },
  button_outline: {
    backgroundColor: Neo.surface,
  },
  button_destructive: {
    backgroundColor: Neo.destructive,
  },
  button_ghost: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: Neo.foreground,
    textAlign: 'center',
  },
  buttonTextDark: {
    color: Neo.destructiveForeground,
  },
  buttonTextGhost: {
    textDecorationLine: 'underline',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  pressed: {
    transform: [{ translateX: Neo.shadowOffset }, { translateY: Neo.shadowOffset }],
    shadowOpacity: 0,
    elevation: 0,
  },
  disabled: {
    opacity: 0.55,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  badge_default: {
    backgroundColor: Neo.main,
  },
  badge_outline: {
    backgroundColor: Neo.surface,
  },
  badge_secondary: {
    backgroundColor: Neo.muted,
  },
  badge_success: {
    backgroundColor: Neo.success,
  },
  badge_warning: {
    backgroundColor: Neo.warning,
  },
  badgeText: {
    color: Neo.foreground,
  },
  alert: {
    gap: Spacing.one,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    padding: Spacing.three,
    ...NeoShadow,
  },
  alert_default: {
    backgroundColor: Neo.main,
  },
  alert_warning: {
    backgroundColor: Neo.warning,
  },
  alert_destructive: {
    backgroundColor: Neo.destructive,
  },
  alertDestructiveText: {
    color: Neo.destructiveForeground,
  },
  empty: {
    alignItems: 'flex-start',
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    minHeight: 48,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.surface,
    color: Neo.foreground,
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: Spacing.three,
  },
  textArea: {
    minHeight: 96,
    paddingTop: Spacing.two,
    textAlignVertical: 'top',
  },
  fieldError: {
    color: '#B42318',
    fontSize: 13,
    fontWeight: '700',
  },
  segmented: {
    flexDirection: 'row',
    gap: Spacing.two,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.muted,
    padding: Spacing.one,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Neo.radius,
    paddingHorizontal: Spacing.two,
  },
  segmentActive: {
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.surface,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingVertical: Spacing.one,
  },
  checkbox: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.surface,
  },
  checkboxChecked: {
    backgroundColor: Neo.main,
  },
  checkboxLabel: {
    flex: 1,
  },
});
