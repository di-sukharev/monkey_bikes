import { useRouter, type Href } from 'expo-router';

import {
  AlertBox,
  BackButton,
  Button,
  Card,
  LoadingState,
  Screen,
  ScreenHeader,
} from '@/components/ui/primitives';
import { TEST_IDS } from '@/constants/testIds';
import { useAuth } from '@/lib/auth';
import { goBackOrReplace } from '@/lib/navigation';

export function AuthRequired({
  backLabel = 'Назад',
  description = 'Войдите в клиентский аккаунт, чтобы продолжить.',
  fallbackHref,
  redirectTo,
  title = 'Нужен вход',
  withinTabs = false,
}: {
  backLabel?: string;
  description?: string;
  fallbackHref?: Href;
  redirectTo: string;
  title?: string;
  withinTabs?: boolean;
}) {
  const router = useRouter();

  return (
    <Screen withinTabs={withinTabs}>
      <ScreenHeader
        eyebrow={fallbackHref ? undefined : 'Аккаунт'}
        leading={
          fallbackHref ? (
            <BackButton
              label={backLabel}
              testID={TEST_IDS.navigation.backButton}
              onPress={() => goBackOrReplace(router, fallbackHref)}
            />
          ) : undefined
        }
        title={title}
        description={description}
      />
      <Card>
        <Button
          fullWidth
          testID={TEST_IDS.auth.openAuthButton}
          onPress={() =>
            router.push({
              pathname: '/auth',
              params: { redirectTo },
            })
          }>
          Войти или зарегистрироваться
        </Button>
      </Card>
    </Screen>
  );
}

export function CustomerOnlyGate({
  backLabel = 'Назад',
  fallbackHref,
  withinTabs = false,
}: {
  backLabel?: string;
  fallbackHref?: Href;
  withinTabs?: boolean;
} = {}) {
  const auth = useAuth();
  const router = useRouter();

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." withinTabs={withinTabs} />;
  }

  if (!auth.user) {
    return null;
  }

  if (auth.user.role === 'user') {
    return null;
  }

  return (
    <Screen withinTabs={withinTabs}>
      <ScreenHeader
        eyebrow={fallbackHref ? undefined : 'Роль аккаунта'}
        leading={
          fallbackHref ? (
            <BackButton
              label={backLabel}
              testID={TEST_IDS.navigation.backButton}
              onPress={() => goBackOrReplace(router, fallbackHref)}
            />
          ) : undefined
        }
        title="Нужен клиентский аккаунт"
        description="Мобильное приложение доступно только клиентам. Админские и производственные сценарии остаются в web."
      />
      <AlertBox
        title="Текущая роль не поддерживается"
        description="Выйдите и войдите в клиентский аккаунт, чтобы оформлять заявки на аренду."
        variant="warning"
      />
      <Button fullWidth variant="destructive" onPress={() => void auth.logout()}>
        Выйти
      </Button>
    </Screen>
  );
}
