import { useQuery } from '@tanstack/react-query';
import type { BicycleSize, PublicBicycleDto } from '@web-app-demo/contracts';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AlertBox,
  Badge,
  Button,
  Card,
  CheckboxRow,
  EmptyState,
  LoadingState,
  Screen,
  ScreenHeader,
  TextField,
} from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { TEST_IDS } from '@/constants/testIds';
import { Neo, Spacing } from '@/constants/theme';
import { bicycleSizes, formatMoney, toggleSelection } from '@/features/bicycles/model';
import { formatRequestError } from '@/lib/request-error';
import { useAuth } from '@/lib/auth';

const pageSize = 20;

export default function CatalogScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sizes, setSizes] = useState<BicycleSize[]>([]);
  const [city, setCity] = useState('');
  const [minPriceKopecks, setMinPriceKopecks] = useState('');
  const [maxPriceKopecks, setMaxPriceKopecks] = useState('');
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const hasCompleteRentalPeriod = startsOn !== '' && endsOn !== '';

  const catalogQuery = useQuery({
    queryKey: [
      'catalog',
      'bicycles',
      page,
      sizes,
      city,
      minPriceKopecks,
      maxPriceKopecks,
      startsOn,
      endsOn,
    ],
    queryFn: () =>
      auth.api.publicBicycles({
        page,
        pageSize,
        ...(sizes.length === 0 ? {} : { sizes }),
        ...(city.trim() ? { city } : {}),
        ...(minPriceKopecks ? { minPriceKopecks: Number(minPriceKopecks) } : {}),
        ...(maxPriceKopecks ? { maxPriceKopecks: Number(maxPriceKopecks) } : {}),
        ...(hasCompleteRentalPeriod ? { startsOn, endsOn } : {}),
      }),
  });

  const data = catalogQuery.data;
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

  if (auth.isBootstrapping && !data) {
    return <LoadingState message="Проверяем сессию..." withinTabs />;
  }

  return (
    <Screen testID={TEST_IDS.catalog.screen} withinTabs>
      <ScreenHeader
        eyebrow="Каталог"
        title="Велосипеды"
        description="Доступные промодерированные велосипеды для клиентских заявок."
        action={data ? <Badge variant="secondary">{data.total} шт.</Badge> : null}
      />

      <Card>
        <TextField
          label="Город"
          testID={TEST_IDS.catalog.cityInput}
          value={city}
          onChangeText={(value) => {
            setPage(1);
            setCity(value);
          }}
        />
        <View style={styles.filterRow}>
          <View style={styles.filterColumn}>
            <TextField
              keyboardType="number-pad"
              label="Мин. цена, копейки"
              testID={TEST_IDS.catalog.minPriceInput}
              value={minPriceKopecks}
              onChangeText={(value) => {
                setPage(1);
                setMinPriceKopecks(value);
              }}
            />
          </View>
          <View style={styles.filterColumn}>
            <TextField
              keyboardType="number-pad"
              label="Макс. цена, копейки"
              testID={TEST_IDS.catalog.maxPriceInput}
              value={maxPriceKopecks}
              onChangeText={(value) => {
                setPage(1);
                setMaxPriceKopecks(value);
              }}
            />
          </View>
        </View>
        <View style={styles.filterRow}>
          <View style={styles.filterColumn}>
            <TextField
              label="Дата начала"
              placeholder="YYYY-MM-DD"
              testID={TEST_IDS.catalog.startDateInput}
              value={startsOn}
              onChangeText={(value) => {
                setPage(1);
                setStartsOn(value);
              }}
            />
          </View>
          <View style={styles.filterColumn}>
            <TextField
              label="Дата окончания"
              placeholder="YYYY-MM-DD"
              testID={TEST_IDS.catalog.endDateInput}
              value={endsOn}
              onChangeText={(value) => {
                setPage(1);
                setEndsOn(value);
              }}
            />
          </View>
        </View>
        <View style={styles.sizeRow}>
          {bicycleSizes.map((size) => (
            <Button
              key={size}
              variant={sizes.includes(size) ? 'default' : 'outline'}
              testID={sizeTestId(size)}
              onPress={() => {
                setPage(1);
                setSizes((current) =>
                  current.includes(size)
                    ? current.filter((currentSize) => currentSize !== size)
                    : [...current, size],
                );
              }}>
              {size}
            </Button>
          ))}
        </View>
      </Card>

      {catalogQuery.isError ? (
        <AlertBox
          title="Не удалось загрузить каталог"
          description={formatRequestError(catalogQuery.error)}
          variant="destructive"
        />
      ) : null}

      {selectedIds.length > 0 ? (
        <AlertBox
          title={`Выбрано велосипедов: ${selectedIds.length}`}
          description="Можно оформить одну заявку сразу на несколько велосипедов."
        />
      ) : null}

      {selectedIds.length > 0 ? (
        <Button
          fullWidth
          testID={TEST_IDS.catalog.createOrderButton}
          onPress={() =>
            router.push(`/orders/new?bicycleIds=${encodeURIComponent(selectedIds.join(','))}`)
          }>
          Создать заявку
        </Button>
      ) : null}

      {catalogQuery.isLoading ? <AlertBox title="Загружаем велосипеды..." /> : null}

      {data && data.items.length === 0 ? (
        <EmptyState
          title="Велосипеды не найдены"
          description="Текущие фильтры не вернули доступные велосипеды."
        />
      ) : null}

      {data?.items.map((bicycle, index) => (
        <BicycleCard
          bicycle={bicycle}
          key={bicycle.id}
          selectTestID={index === 0 ? TEST_IDS.catalog.firstBicycleSelect : undefined}
          selected={selectedIds.includes(bicycle.id)}
          onOpen={() => router.push(`/bicycles/${bicycle.id}`)}
          onSelectedChange={() => setSelectedIds((current) => toggleSelection(current, bicycle.id))}
        />
      ))}

      <View style={styles.pagination}>
        <Button
          disabled={page <= 1 || catalogQuery.isFetching}
          variant="outline"
          onPress={() => setPage((current) => Math.max(1, current - 1))}>
          Назад
        </Button>
        <Badge variant="outline">
          {page}/{totalPages}
        </Badge>
        <Button
          disabled={page >= totalPages || catalogQuery.isFetching}
          variant="outline"
          onPress={() => setPage((current) => current + 1)}>
          Далее
        </Button>
      </View>
    </Screen>
  );
}

function BicycleCard({
  bicycle,
  onOpen,
  onSelectedChange,
  selectTestID,
  selected,
}: {
  bicycle: PublicBicycleDto;
  onOpen: () => void;
  onSelectedChange: () => void;
  selectTestID?: string;
  selected: boolean;
}) {
  const imageUrl = bicycle.photoUrls[0];

  return (
    <Card>
      <CheckboxRow
        checked={selected}
        label="Выбрать для заявки"
        onChange={onSelectedChange}
        testID={selectTestID}
      />
      {imageUrl ? (
        <Pressable onPress={onOpen}>
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
        </Pressable>
      ) : (
        <View style={styles.imagePlaceholder} />
      )}
      <View style={styles.badgeRow}>
        <Badge>{bicycle.size}</Badge>
        <Badge variant="secondary">{formatMoney(bicycle.pricePerDayKopecks)} / день</Badge>
        <Badge variant="outline">Залог {formatMoney(bicycle.depositKopecks)}</Badge>
      </View>
      <View style={styles.cardText}>
        <ThemedText type="smallBold">{bicycle.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {bicycle.manufacturer.publicName}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {bicycle.city}
          {bicycle.deliveryAvailable ? ' · Доставка' : ' · Самовывоз'}
        </ThemedText>
      </View>
      <Button variant="outline" onPress={onOpen}>
        Детали
      </Button>
    </Card>
  );
}

function sizeTestId(size: BicycleSize) {
  if (size === 'S') return TEST_IDS.catalog.sizeS;
  if (size === 'M') return TEST_IDS.catalog.sizeM;
  return TEST_IDS.catalog.sizeL;
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  filterColumn: {
    flex: 1,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  cardText: {
    gap: Spacing.two,
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.muted,
  },
  imagePlaceholder: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.muted,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
});
