import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AuthRequired, CustomerOnlyGate } from '@/components/auth-gates';
import {
  AlertBox,
  Badge,
  Button,
  Card,
  LoadingState,
  Screen,
  ScreenHeader,
} from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { TEST_IDS } from '@/constants/testIds';
import { Neo, Spacing } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function ProfileScreen() {
  const auth = useAuth();
  const router = useRouter();

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." withinTabs />;
  }

  if (!auth.user) {
    return <AuthRequired redirectTo="/profile" title="Нужен вход" withinTabs />;
  }

  if (auth.user.role !== 'user') {
    return <CustomerOnlyGate withinTabs />;
  }

  return (
    <Screen testID={TEST_IDS.profile.screen} withinTabs>
      <ScreenHeader
        eyebrow="Профиль"
        title={auth.user.displayName ?? auth.user.email}
        description="Клиентский аккаунт для заявок на аренду."
        action={<Badge variant="success">active</Badge>}
      />

      <Card testID={TEST_IDS.auth.dashboard}>
        <Fact label="Email" value={auth.user.email} testID={TEST_IDS.auth.userEmail} />
        <Fact label="ID пользователя" value={auth.user.id} />
        <Fact label="Роль" value="Клиент" />
        <AlertBox
          title="Контакты для заявок"
          description="Имя, телефон и адрес доставки указываются в каждой заявке отдельно."
        />
        <Button
          fullWidth
          testID={TEST_IDS.auth.logoutButton}
          variant="destructive"
          onPress={() => {
            void auth.logout().then(() => router.replace('/catalog'));
          }}>
          Выйти
        </Button>
      </Card>
    </Screen>
  );
}

function Fact({ label, testID, value }: { label: string; testID?: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" testID={testID}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  fact: {
    gap: Spacing.one,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.muted,
    padding: Spacing.two,
  },
});
