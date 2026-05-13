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
import { fulfillmentTypes, type OrderFormValues } from './model'

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
      onChange: ({ value }) => {
        const result = orderCreateRequestSchema.safeParse(value)
        return result.success ? undefined : result.error.issues
      },
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
                label="Starts on"
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
                label="Ends on"
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
                <FieldLabel htmlFor={field.name}>Fulfillment</FieldLabel>
                <NativeSelect
                  disabled={disabled}
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value as FulfillmentType)}
                >
                  {fulfillmentTypes.map((type) => (
                    <NativeSelectOption key={type} value={type}>
                      {type}
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
                label="Delivery address"
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
                label="Contact name"
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
                label="Contact phone"
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
              label="Comment"
              name={field.name}
              value={field.state.value ?? ''}
              onBlur={field.handleBlur}
              onChange={(value) => field.handleChange(value)}
            />
          )}
        />

        <Alert>
          <ShieldCheckIcon />
          <AlertTitle>Safety agreement</AlertTitle>
          <AlertDescription>
            Use the bicycle only with trained supervision, within the stated load and fit limits,
            on a controlled surface. Stop the rental activity immediately if the rider shows stress
            or the environment becomes unsafe.
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
              <FieldLabel htmlFor={field.name}>Safety rules accepted</FieldLabel>
              <FieldErrors
                id={fieldErrorId(field.name, field.state.meta.errors)}
                errors={field.state.meta.errors}
              />
            </Field>
          )}
        />

        <div className="flex justify-end">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
            children={([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={disabled || !canSubmit || isSubmitting}>
                Create request
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

  return <FieldError id={id}>{errors.map(formatError).join(', ')}</FieldError>
}

function fieldErrorId(fieldName: string, errors: unknown[]) {
  return errors.length > 0 ? `${fieldName}-error` : undefined
}

function formatError(error: unknown) {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }
  return 'Invalid value'
}
