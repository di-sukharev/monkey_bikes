import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import {
  orderCreateRequestSchema,
  type FulfillmentType,
  type OrderCreateInput,
} from '@web-app-demo/contracts';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AuthRequired, CustomerOnlyGate } from '@/components/auth-gates';
import {
  AlertBox,
  BackButton,
  Badge,
  Button,
  Card,
  CheckboxRow,
  EmptyState,
  LoadingState,
  Screen,
  ScreenHeader,
  SegmentedControl,
  TextField,
} from '@/components/ui/primitives';
import { ThemedText } from '@/components/themed-text';
import { TEST_IDS } from '@/constants/testIds';
import { Neo, Spacing } from '@/constants/theme';
import { formatMoney, parseBicycleIds } from '@/features/bicycles/model';
import {
  fulfillmentTypeLabel,
  selectedBicyclesTotal,
} from '@/features/orders/model';
import { createFormSchemaValidator } from '@/lib/form-schema-validator';
import { formatFormError } from '@/lib/form-errors';
import { formatRequestError } from '@/lib/request-error';
import { useAuth } from '@/lib/auth';
import { goBackOrReplace } from '@/lib/navigation';

type OrderFormValues = Omit<OrderCreateInput, 'safetyAgreementAccepted'> & {
  safetyAgreementAccepted: boolean;
};

const fulfillmentOptions: { label: string; value: FulfillmentType }[] = [
  { label: fulfillmentTypeLabel('pickup'), value: 'pickup' },
  { label: fulfillmentTypeLabel('delivery'), value: 'delivery' },
];

export default function OrderRequestScreen() {
  const auth = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ bicycleIds?: string | string[] }>();
  const bicycleIds = parseBicycleIds(params.bicycleIds);

  const selectedBicyclesQuery = useQuery({
    queryKey: ['orders', 'selected-bicycles', bicycleIds],
    enabled: auth.user?.role === 'user' && bicycleIds.length > 0,
    queryFn: async () => {
      const responses = await Promise.all(bicycleIds.map((id) => auth.api.publicBicycle(id)));
      return responses.map((response) => response.bicycle);
    },
  });

  const createOrder = useMutation({
    mutationFn: (input: OrderCreateInput) => auth.api.createOrder(input),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ['orders', auth.user?.id ?? null] });
      router.replace(`/orders/${response.order.id}`);
    },
  });

  const form = useForm({
    defaultValues: emptyOrderForm(bicycleIds),
    validators: {
      onSubmit: ({ value }) =>
        createFormSchemaValidator(orderCreateRequestSchema)({
          value: normalizedOrderForm(value),
        }),
    },
    onSubmit: async ({ value }) => {
      await createOrder.mutateAsync(orderCreateRequestSchema.parse(normalizedOrderForm(value)));
    },
  });

  if (auth.isBootstrapping) {
    return <LoadingState message="Проверяем сессию..." />;
  }

  if (!auth.user) {
    return (
      <AuthRequired
        fallbackHref="/catalog"
        redirectTo={`/orders/new?bicycleIds=${encodeURIComponent(bicycleIds.join(','))}`}
        title="Нужен клиентский аккаунт"
        description="Создание заявки доступно после входа."
      />
    );
  }

  if (auth.user.role !== 'user') {
    return <CustomerOnlyGate fallbackHref="/catalog" />;
  }

  if (bicycleIds.length === 0) {
    return (
      <Screen>
        <ScreenHeader
          leading={
            <BackButton
              testID={TEST_IDS.navigation.backButton}
              onPress={() => goBackOrReplace(router, '/catalog')}
            />
          }
          title="Заявка"
          description="Выберите велосипед в каталоге перед созданием заявки."
        />
        <EmptyState
          title="Велосипеды не выбраны"
          description="Выберите один или несколько велосипедов в каталоге перед созданием заявки."
          action={<Button onPress={() => router.push('/catalog')}>Открыть каталог</Button>}
        />
      </Screen>
    );
  }

  const selectedBicycles = selectedBicyclesQuery.data ?? [];
  const totals = selectedBicyclesTotal(selectedBicycles);

  return (
    <Screen testID={TEST_IDS.orderRequest.screen}>
      <ScreenHeader
        leading={
          <BackButton
            testID={TEST_IDS.navigation.backButton}
            onPress={() => goBackOrReplace(router, '/catalog')}
          />
        }
        title="Создать заявку"
        description="Выберите даты, способ получения, контакт и подтвердите правила безопасности."
      />

      {selectedBicyclesQuery.isLoading ? <AlertBox title="Загружаем выбранные велосипеды..." /> : null}

      {selectedBicyclesQuery.isError ? (
        <AlertBox
          title="Не удалось загрузить выбранные велосипеды"
          description={formatRequestError(selectedBicyclesQuery.error)}
          variant="destructive"
        />
      ) : null}

      {selectedBicycles.length > 0 ? (
        <Card>
          <ThemedText type="smallBold">Выбранные велосипеды</ThemedText>
          {selectedBicycles.map((bicycle) => (
            <View key={bicycle.id} style={styles.selectedRow}>
              <View style={styles.selectedText}>
                <ThemedText type="smallBold">{bicycle.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {bicycle.city}, {formatMoney(bicycle.pricePerDayKopecks)} / день
                </ThemedText>
              </View>
              <Badge>{bicycle.size}</Badge>
            </View>
          ))}
          <AlertBox
            title="Расчет на сервере"
            description={`Дневная сумма ${formatMoney(totals.daily)}, залог ${formatMoney(totals.deposit)}. Итоговые дни и суммы фиксирует backend.`}
          />
        </Card>
      ) : null}

      <Card>
        <View style={styles.formGrid}>
          <form.Field name="startsOn">
            {(field) => (
              <TextField
                error={fieldErrors(field.state.meta.errors)}
                label="Дата начала"
                placeholder="YYYY-MM-DD"
                testID={TEST_IDS.orderRequest.startDateInput}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
              />
            )}
          </form.Field>
          <form.Field name="endsOn">
            {(field) => (
              <TextField
                error={fieldErrors(field.state.meta.errors)}
                label="Дата окончания"
                placeholder="YYYY-MM-DD"
                testID={TEST_IDS.orderRequest.endDateInput}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
              />
            )}
          </form.Field>
        </View>

        <form.Field name="fulfillmentType">
          {(field) => (
            <SegmentedControl
              accessibilityLabel="Способ получения"
              value={field.state.value}
              options={fulfillmentOptions}
              onChange={(value) => {
                field.handleChange(value);
                if (value === 'pickup') {
                  form.setFieldValue('deliveryAddress', null);
                }
              }}
            />
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.values.fulfillmentType}>
          {(fulfillmentType) => (
            <form.Field name="deliveryAddress">
              {(field) => (
                <TextField
                  disabled={fulfillmentType === 'pickup'}
                  error={fieldErrors(field.state.meta.errors)}
                  label="Адрес доставки"
                  testID={TEST_IDS.orderRequest.deliveryAddressInput}
                  value={typeof field.state.value === 'string' ? field.state.value : ''}
                  onBlur={field.handleBlur}
                  onChangeText={(value) => field.handleChange(value)}
                />
              )}
            </form.Field>
          )}
        </form.Subscribe>

        <form.Field name="contactName">
          {(field) => (
            <TextField
              error={fieldErrors(field.state.meta.errors)}
              label="Имя контактного лица"
              testID={TEST_IDS.orderRequest.contactNameInput}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
            />
          )}
        </form.Field>
        <form.Field name="contactPhone">
          {(field) => (
            <TextField
              error={fieldErrors(field.state.meta.errors)}
              keyboardType="phone-pad"
              label="Телефон контактного лица"
              testID={TEST_IDS.orderRequest.contactPhoneInput}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
            />
          )}
        </form.Field>
        <form.Field name="userComment">
          {(field) => (
            <TextField
              multiline
              error={fieldErrors(field.state.meta.errors)}
              label="Комментарий"
              testID={TEST_IDS.orderRequest.userCommentInput}
                  value={typeof field.state.value === 'string' ? field.state.value : ''}
              onBlur={field.handleBlur}
              onChangeText={(value) => field.handleChange(value)}
            />
          )}
        </form.Field>

        <AlertBox
          title="Правила безопасности"
          description="Используйте велосипед только под подготовленным присмотром, в пределах ограничений по нагрузке и размеру, на контролируемой поверхности."
        />

        <form.Field name="safetyAgreementAccepted">
          {(field) => (
            <View>
              <CheckboxRow
                checked={field.state.value === true}
                label="Правила безопасности приняты"
                testID={TEST_IDS.orderRequest.safetyCheckbox}
                onChange={(checked) => field.handleChange(checked)}
              />
              {fieldErrors(field.state.meta.errors) ? (
                <ThemedText style={styles.errorText}>{fieldErrors(field.state.meta.errors)}</ThemedText>
              ) : null}
            </View>
          )}
        </form.Field>

        {createOrder.error ? (
          <AlertBox
            title="Не удалось создать заявку"
            description={formatRequestError(createOrder.error)}
            variant="destructive"
          />
        ) : null}

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              disabled={selectedBicycles.length === 0 || createOrder.isPending || isSubmitting}
              fullWidth
              testID={TEST_IDS.orderRequest.createButton}
              onPress={() => void form.handleSubmit()}>
              Создать заявку
            </Button>
          )}
        </form.Subscribe>
      </Card>
    </Screen>
  );
}

function emptyOrderForm(bicycleIds: string[]): OrderFormValues {
  return {
    bicycleIds,
    startsOn: '',
    endsOn: '',
    fulfillmentType: 'pickup',
    deliveryAddress: null,
    contactName: '',
    contactPhone: '',
    userComment: null,
    safetyAgreementAccepted: false,
  };
}

function normalizedOrderForm(value: OrderFormValues) {
  return {
    ...value,
    deliveryAddress: value.fulfillmentType === 'pickup' ? null : value.deliveryAddress,
    userComment: value.userComment === '' ? null : value.userComment,
  };
}

function fieldErrors(errors: unknown[]) {
  return errors.length ? errors.map(formatFormError).join(', ') : null;
}

const styles = StyleSheet.create({
  formGrid: {
    gap: Spacing.two,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Neo.radius,
    borderWidth: Neo.borderWidth,
    borderColor: Neo.border,
    backgroundColor: Neo.muted,
    padding: Spacing.two,
  },
  selectedText: {
    flex: 1,
    gap: Spacing.one,
  },
  errorText: {
    marginTop: Spacing.two,
    color: '#B42318',
    fontSize: 13,
    fontWeight: '700',
  },
});
