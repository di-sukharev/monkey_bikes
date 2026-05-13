import { useForm } from '@tanstack/react-form'
import { bicycleUpsertRequestSchema, type BicycleUpsertInput } from '@web-app-demo/contracts'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { formatFormError } from '@/lib/form-errors'
import { bicycleSizes, type BicycleFormValues } from './model'

export function BicycleForm({
  disabled,
  initialValues,
  mode,
  onSubmit,
}: {
  disabled: boolean
  initialValues: BicycleFormValues
  mode: 'create' | 'edit'
  onSubmit: (input: BicycleUpsertInput) => void
}) {
  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: ({ value }) => {
        const result = bicycleUpsertRequestSchema.safeParse(value)
        return result.success ? undefined : result.error.issues
      },
    },
    onSubmit: async ({ value }) => {
      onSubmit(bicycleUpsertRequestSchema.parse(value))
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <FieldGroup>
        <div className="grid gap-4 md:grid-cols-2">
          <form.Field
            name="title"
            children={(field) => (
              <TextInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Название"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="size"
            children={(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor={field.name}>Размер</FieldLabel>
                <NativeSelect
                  disabled={disabled}
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value as BicycleFormValues['size'])}
                >
                  {bicycleSizes.map((size) => (
                    <NativeSelectOption key={size} value={size}>
                      {size}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldErrors
                  id={fieldErrorId(field.name, field.state.meta.errors)}
                  errors={field.state.meta.errors}
                />
              </Field>
            )}
          />
          <form.Field
            name="pricePerDayKopecks"
            children={(field) => (
              <NumberInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Цена за день, копейки"
                min={100}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="depositKopecks"
            children={(field) => (
              <NumberInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Залог, копейки"
                min={0}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="city"
            children={(field) => (
              <TextInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Город"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="region"
            children={(field) => (
              <TextInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Регион"
                name={field.name}
                value={field.state.value ?? ''}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="pickupAddress"
            children={(field) => (
              <TextInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Адрес самовывоза"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="maxLoadKg"
            children={(field) => (
              <NumberInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Максимальная нагрузка, кг"
                min={1}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="seatHeightCm"
            children={(field) => (
              <NumberInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Высота сиденья, см"
                min={1}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="frameLengthCm"
            children={(field) => (
              <NumberInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Длина рамы, см"
                min={1}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="wheelDiameterCm"
            children={(field) => (
              <NumberInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Диаметр колеса, см"
                min={1}
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="deliveryAvailable"
            children={(field) => (
              <Field orientation="horizontal" data-invalid={field.state.meta.errors.length > 0}>
                <Checkbox
                  id={field.name}
                  checked={field.state.value}
                  disabled={disabled}
                  onCheckedChange={(checked) => field.handleChange(checked === true)}
                />
                <FieldLabel htmlFor={field.name}>Доставка доступна</FieldLabel>
              </Field>
            )}
          />
        </div>

        <form.Field
          name="photoUrls"
          children={(field) => (
            <TextareaInput
              disabled={disabled}
              errors={field.state.meta.errors}
              label="Ссылки на фотографии"
              name={field.name}
              value={field.state.value.join('\n')}
              onBlur={field.handleBlur}
              onChange={(value) =>
                field.handleChange(value.split('\n').map((url) => url.trim()).filter(Boolean))
              }
            />
          )}
        />
        <form.Field
          name="description"
          children={(field) => (
            <TextareaInput
              disabled={disabled}
              errors={field.state.meta.errors}
              label="Описание"
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
            />
          )}
        />
        <form.Field
          name="recommendedAnimalDimensions"
          children={(field) => (
            <TextareaInput
              disabled={disabled}
              errors={field.state.meta.errors}
              label="Рекомендуемые габариты животного"
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
            />
          )}
        />
        <form.Field
          name="safetyNotes"
          children={(field) => (
            <TextareaInput
              disabled={disabled}
              errors={field.state.meta.errors}
              label="Примечания по безопасности"
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
            />
          )}
        />

        <div className="flex justify-end">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
            children={([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={disabled || !canSubmit || isSubmitting}>
                {mode === 'create' ? 'Создать черновик' : 'Сохранить черновик'}
              </Button>
            )}
          />
        </div>
      </FieldGroup>
    </form>
  )
}

function TextInput({
  disabled,
  errors,
  label,
  name,
  onBlur,
  onChange,
  value,
}: {
  disabled: boolean
  errors: unknown[]
  label: string
  name: string
  onBlur: () => void
  onChange: (value: string) => void
  value: string
}) {
  const errorId = fieldErrorId(name, errors)

  return (
    <Field data-invalid={errors.length > 0}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        className="h-11"
        disabled={disabled}
        id={name}
        name={name}
        value={value}
        aria-invalid={errors.length > 0}
        aria-describedby={errorId}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldErrors id={errorId} errors={errors} />
    </Field>
  )
}

function NumberInput({
  disabled,
  errors,
  label,
  min,
  name,
  onBlur,
  onChange,
  value,
}: {
  disabled: boolean
  errors: unknown[]
  label: string
  min: number
  name: string
  onBlur: () => void
  onChange: (value: number) => void
  value: number
}) {
  const errorId = fieldErrorId(name, errors)

  return (
    <Field data-invalid={errors.length > 0}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input
        className="h-11"
        disabled={disabled}
        id={name}
        min={min}
        name={name}
        type="number"
        value={value}
        aria-invalid={errors.length > 0}
        aria-describedby={errorId}
        onBlur={onBlur}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <FieldErrors id={errorId} errors={errors} />
    </Field>
  )
}

function TextareaInput({
  disabled,
  errors,
  label,
  name,
  onBlur,
  onChange,
  value,
}: {
  disabled: boolean
  errors: unknown[]
  label: string
  name: string
  onBlur: () => void
  onChange: (value: string) => void
  value: string
}) {
  const errorId = fieldErrorId(name, errors)

  return (
    <Field data-invalid={errors.length > 0}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Textarea
        className="min-h-24"
        disabled={disabled}
        id={name}
        name={name}
        value={value}
        aria-invalid={errors.length > 0}
        aria-describedby={errorId}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldErrors id={errorId} errors={errors} />
    </Field>
  )
}

function FieldErrors({ errors, id }: { errors: unknown[]; id: string | undefined }) {
  if (!errors.length) return null

  return <FieldError id={id}>{errors.map(formatFormError).join(', ')}</FieldError>
}

function fieldErrorId(fieldName: string, errors: unknown[]) {
  return errors.length > 0 ? `${fieldName}-error` : undefined
}
