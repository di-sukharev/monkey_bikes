import { useForm } from '@tanstack/react-form';
import {
  loginRequestSchema,
  registerRequestSchema,
  type LoginRequest,
  type RegisterRequest,
} from '@web-app-demo/contracts';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import {
  AlertBox,
  BackButton,
  Button,
  Card,
  Screen,
  ScreenHeader,
  SegmentedControl,
  TextField,
} from '@/components/ui/primitives';
import { TEST_IDS } from '@/constants/testIds';
import { createFormSchemaValidator } from '@/lib/form-schema-validator';
import { formatFormError } from '@/lib/form-errors';
import { formatRequestError } from '@/lib/request-error';
import { useAuth } from '@/lib/auth';
import { goBackOrReplace } from '@/lib/navigation';

type AuthMode = 'login' | 'register';

export default function AuthScreen() {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ redirectTo?: string }>();
  const redirectTo = sanitizeRedirectTo(params.redirectTo);
  const [mode, setMode] = useState<AuthMode>('register');
  const [error, setError] = useState<string | null>(null);
  const isRegister = mode === 'register';
  const isE2E = process.env.EXPO_PUBLIC_E2E === '1';

  const form = useForm({
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
    },
    validators: {
      onSubmit: ({ value }) =>
        createFormSchemaValidator(isRegister ? registerRequestSchema : loginRequestSchema)({
          value,
        }),
    },
    onSubmit: async ({ value }) => {
      setError(null);

      try {
        if (isRegister) {
          await auth.register(registerRequestSchema.parse(value) as RegisterRequest);
        } else {
          await auth.login(loginRequestSchema.parse(value) as LoginRequest);
        }

        router.replace(redirectTo as Href);
      } catch (caughtError) {
        setError(formatRequestError(caughtError));
      }
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}>
      <Screen>
        <ScreenHeader
          leading={
            <BackButton
              testID={TEST_IDS.navigation.backButton}
              onPress={() => goBackOrReplace(router, '/catalog')}
            />
          }
          title="Вход клиента"
          description="Мобильное приложение работает только для клиентских заявок на аренду."
        />

        <Card>
          <SegmentedControl
            accessibilityLabel="Режим авторизации"
            value={mode}
            options={[
              { label: 'Регистрация', value: 'register', testID: TEST_IDS.auth.registerTab },
              { label: 'Вход', value: 'login', testID: TEST_IDS.auth.loginTab },
            ]}
            onChange={(nextMode) => {
              setError(null);
              setMode(nextMode);
            }}
          />

          {isRegister ? (
            <form.Field name="displayName">
              {(field) => (
                <TextField
                  error={fieldErrors(field.state.meta.errors)}
                  label="Имя"
                  testID={TEST_IDS.auth.nameInput}
                  value={field.state.value ?? ''}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                />
              )}
            </form.Field>
          ) : null}

          <form.Field name="email">
            {(field) => (
              <TextField
                autoCapitalize="none"
                autoCorrect={false}
                error={fieldErrors(field.state.meta.errors)}
                keyboardType="email-address"
                label="Email"
                textContentType="emailAddress"
                testID={TEST_IDS.auth.emailInput}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
              />
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <TextField
                autoCapitalize="none"
                autoCorrect={false}
                error={fieldErrors(field.state.meta.errors)}
                label="Пароль"
                secureTextEntry={!isE2E}
                textContentType={isE2E ? 'none' : isRegister ? 'newPassword' : 'password'}
                testID={TEST_IDS.auth.passwordInput}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
              />
            )}
          </form.Field>

          {error ? <AlertBox title="Не удалось войти" description={error} variant="destructive" /> : null}

          <View>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <Button
                  disabled={isSubmitting}
                  fullWidth
                  testID={TEST_IDS.auth.submitButton}
                  onPress={() => void form.handleSubmit()}>
                  {isSubmitting ? 'Отправляем...' : isRegister ? 'Создать аккаунт' : 'Войти'}
                </Button>
              )}
            </form.Subscribe>
          </View>
        </Card>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function fieldErrors(errors: unknown[]) {
  return errors.length ? errors.map(formatFormError).join(', ') : null;
}

function sanitizeRedirectTo(value: unknown): string {
  if (typeof value !== 'string') return '/catalog';
  if (!value.startsWith('/') || value.startsWith('//') || value === '/auth') return '/catalog';
  return value;
}
