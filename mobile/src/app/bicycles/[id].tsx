import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  AlertBox,
  BackButton,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Screen,
  ScreenHeader,
} from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { TEST_IDS } from '@/constants/testIds';
import { Neo, Spacing } from '@/constants/theme';
import { formatMoney } from '@/features/bicycles/model';
import { formatRequestError } from '@/lib/request-error';
import { useAuth } from '@/lib/auth';
import { goBackOrReplace } from '@/lib/navigation';

export default function BicycleDetailScreen() {
  const auth = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const bicycleQuery = useQuery({
    queryKey: ['catalog', 'bicycles', id],
    enabled: id.length > 0,
    queryFn: () => auth.api.publicBicycle(id),
  });

  if (!id) {
    return (
      <Screen>
        <ScreenHeader
          leading={
            <BackButton
              label="Каталог"
              testID={TEST_IDS.navigation.backButton}
              onPress={() => goBackOrReplace(router, '/catalog')}
            />
          }
          title="Велосипед"
          description="Откройте карточку из каталога."
        />
        <EmptyState title="Велосипед не выбран" description="Откройте карточку из каталога." />
      </Screen>
    );
  }

  if (bicycleQuery.isLoading) {
    return <LoadingState message="Загружаем велосипед..." />;
  }

  if (bicycleQuery.isError) {
    return (
      <Screen>
        <ScreenHeader
          leading={
            <BackButton
              label="Каталог"
              testID={TEST_IDS.navigation.backButton}
              onPress={() => goBackOrReplace(router, '/catalog')}
            />
          }
          title="Велосипед недоступен"
          description={formatRequestError(bicycleQuery.error)}
        />
        <Button onPress={() => router.push('/catalog')}>Назад в каталог</Button>
      </Screen>
    );
  }

  const bicycle = bicycleQuery.data?.bicycle;

  if (!bicycle) {
    return <LoadingState message="Загружаем велосипед..." />;
  }

  const requestRedirectTo = `/orders/new?bicycleIds=${encodeURIComponent(bicycle.id)}`;
  const primaryImage = bicycle.photoUrls[0];

  return (
    <Screen>
      <ScreenHeader
        leading={
          <BackButton
            label="Каталог"
            testID={TEST_IDS.navigation.backButton}
            onPress={() => goBackOrReplace(router, '/catalog')}
          />
        }
        title={bicycle.title}
        description={bicycle.manufacturer.publicName}
        action={<Badge>{bicycle.size}</Badge>}
      />

      <Card>
        {primaryImage ? (
          <Image source={{ uri: primaryImage }} style={styles.heroImage} contentFit="cover" />
        ) : (
          <View style={styles.heroImage} />
        )}
        <View style={styles.badgeRow}>
          <Badge variant="secondary">{formatMoney(bicycle.pricePerDayKopecks)} / день</Badge>
          <Badge variant="outline">Залог {formatMoney(bicycle.depositKopecks)}</Badge>
          <Badge variant={bicycle.deliveryAvailable ? 'success' : 'outline'}>
            {bicycle.deliveryAvailable ? 'Доставка' : 'Самовывоз'}
          </Badge>
        </View>
        <ThemedText>{bicycle.description}</ThemedText>
      </Card>

      <Card>
        <ThemedText type="smallBold">Характеристики</ThemedText>
        <Fact label="Город" value={bicycle.city} />
        <Fact label="Макс. нагрузка" value={`${bicycle.maxLoadKg} кг`} />
        <Fact label="Высота сиденья" value={`${bicycle.seatHeightCm} см`} />
        <Fact label="Длина рамы" value={`${bicycle.frameLengthCm} см`} />
        <Fact label="Диаметр колеса" value={`${bicycle.wheelDiameterCm} см`} />
      </Card>

      <AlertBox title="Самовывоз" description={bicycle.pickupAddress} />
      {bicycle.deliveryAvailable ? (
        <AlertBox title="Доставка" description="Доставку можно запросить при создании заявки." />
      ) : null}
      <AlertBox title="Примечания по безопасности" description={bicycle.safetyNotes} />
      <AlertBox title="Рекомендуемые габариты" description={bicycle.recommendedAnimalDimensions} />

      {auth.user ? (
        <Button
          fullWidth
          onPress={() =>
            router.push({
              pathname: '/orders/new',
              params: { bicycleIds: bicycle.id },
            })
          }>
          Запросить аренду
        </Button>
      ) : (
        <Card>
          <AlertBox
            title="Нужен вход для заявки"
            description="Каталог можно смотреть без входа, а заявку создает клиентский аккаунт."
          />
          <Button
            fullWidth
            onPress={() =>
              router.push({
                pathname: '/auth',
                params: { redirectTo: requestRedirectTo },
              })
            }>
            Войти или зарегистрироваться
          </Button>
        </Card>
      )}
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  heroImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.muted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  fact: {
    gap: Spacing.one,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.muted,
    padding: Spacing.two,
  },
});
