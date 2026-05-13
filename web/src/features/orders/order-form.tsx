import { useForm } from '@tanstack/react-form'
import {
  orderCreateRequestSchema,
  type FulfillmentType,
  type OrderCreateInput,
} from '@web-app-demo/contracts'
import { ShieldCheckIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { formatFormError } from '@/lib/form-errors'
import { createFormSchemaValidator } from '@/lib/form-schema-validator'
import { fulfillmentTypeLabel, fulfillmentTypes, type OrderFormValues } from './model'

export function OrderForm({
  disabled,
  initialValues,
  onSubmit,
}: {
  disabled: boolean
  initialValues: OrderFormValues
  onSubmit: (input: OrderCreateInput) => Promise<void> | void
}) {
  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onSubmit: createFormSchemaValidator(orderCreateRequestSchema),
    },
    onSubmit: async ({ value }) => {
      await onSubmit(orderCreateRequestSchema.parse(value))
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
            name="startsOn"
            children={(field) => (
              <TextInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Дата начала"
                name={field.name}
                type="date"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="endsOn"
            children={(field) => (
              <TextInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Дата окончания"
                name={field.name}
                type="date"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="fulfillmentType"
            children={(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor={field.name}>Получение</FieldLabel>
                <NativeSelect
                  disabled={disabled}
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value as FulfillmentType)}
                >
                  {fulfillmentTypes.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {fulfillmentTypeLabel(type)}
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
            name="deliveryAddress"
            children={(field) => (
              <TextInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Адрес доставки"
                name={field.name}
                value={field.state.value ?? ''}
                onBlur={field.handleBlur}
                onChange={(value) => field.handleChange(value)}
              />
            )}
          />
          <form.Field
            name="contactName"
            children={(field) => (
              <TextInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Имя контактного лица"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
          <form.Field
            name="contactPhone"
            children={(field) => (
              <TextInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Телефон контактного лица"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={field.handleChange}
              />
            )}
          />
        </div>

        <form.Field
          name="userComment"
          children={(field) => (
            <TextareaInput
              disabled={disabled}
              errors={field.state.meta.errors}
              label="Комментарий"
              name={field.name}
              value={field.state.value ?? ''}
              onBlur={field.handleBlur}
              onChange={(value) => field.handleChange(value)}
            />
          )}
        />

        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>Согласие с правилами безопасности</AlertTitle>
          <AlertDescription>
            Используйте велосипед только под подготовленным присмотром, в пределах указанных
            ограничений по нагрузке и размеру, на контролируемой поверхности. Немедленно
            остановите занятие, если участник испытывает стресс или среда становится небезопасной.
          </AlertDescription>
        </Alert>

        <form.Field
          name="safetyAgreementAccepted"
          children={(field) => (
            <Field orientation="horizontal" data-invalid={field.state.meta.errors.length > 0}>
              <Checkbox
                id={field.name}
                checked={field.state.value === true}
                disabled={disabled}
                onCheckedChange={(checked) => field.handleChange(checked === true)}
              />
              <FieldLabel htmlFor={field.name}>Правила безопасности приняты</FieldLabel>
              <FieldErrors
                id={fieldErrorId(field.name, field.state.meta.errors)}
                errors={field.state.meta.errors}
              />
            </Field>
          )}
        />

        <div className="flex justify-end">
          <form.Subscribe
            selector={(state) => state.isSubmitting}
            children={(isSubmitting) => (
              <Button type="submit" disabled={disabled || isSubmitting}>
                Создать заявку
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
  type = 'text',
  value,
}: {
  disabled: boolean
  errors: unknown[]
  label: string
  name: string
  onBlur: () => void
  onChange: (value: string) => void
  type?: 'date' | 'text'
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
        type={type}
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
