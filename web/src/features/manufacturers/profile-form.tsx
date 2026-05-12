import { useForm } from '@tanstack/react-form'
import {
  manufacturerProfileUpsertRequestSchema,
  type ManufacturerProfileUpsertRequest,
} from '@web-app-demo/contracts'

import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function ManufacturerProfileForm({
  disabled,
  initialValues,
  onSubmit,
}: {
  disabled: boolean
  initialValues: ManufacturerProfileUpsertRequest
  onSubmit: (input: ManufacturerProfileUpsertRequest) => void
}) {
  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: ({ value }) => {
        const result = manufacturerProfileUpsertRequestSchema.safeParse(value)
        return result.success ? undefined : result.error.issues
      },
    },
    onSubmit: async ({ value }) => {
      onSubmit(manufacturerProfileUpsertRequestSchema.parse(value))
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
            name="legalName"
            children={(field) => (
              <ProfileInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Legal name"
                name={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              />
            )}
          />
          <form.Field
            name="publicName"
            children={(field) => (
              <ProfileInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Public name"
                name={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              />
            )}
          />
          <form.Field
            name="email"
            children={(field) => (
              <ProfileInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Contact email"
                name={field.name}
                type="email"
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              />
            )}
          />
          <form.Field
            name="phone"
            children={(field) => (
              <ProfileInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Phone"
                name={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              />
            )}
          />
          <form.Field
            name="region"
            children={(field) => (
              <ProfileInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="Region"
                name={field.name}
                value={field.state.value ?? ''}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              />
            )}
          />
          <form.Field
            name="city"
            children={(field) => (
              <ProfileInput
                disabled={disabled}
                errors={field.state.meta.errors}
                label="City"
                name={field.name}
                value={field.state.value}
                onChange={field.handleChange}
                onBlur={field.handleBlur}
              />
            )}
          />
        </div>

        <form.Field
          name="description"
          children={(field) => {
            const errorId = fieldErrorId(field.name, field.state.meta.errors)
            return (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor={field.name}>Description</FieldLabel>
                <Textarea
                  className="min-h-32"
                  disabled={disabled}
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  aria-invalid={field.state.meta.errors.length > 0}
                  aria-describedby={errorId}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                />
                <FieldErrors id={errorId} errors={field.state.meta.errors} />
              </Field>
            )
          }}
        />

        <div className="flex justify-end">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting] as const}
            children={([canSubmit, isSubmitting]) => (
              <Button type="submit" disabled={disabled || !canSubmit || isSubmitting}>
                Save draft
              </Button>
            )}
          />
        </div>
      </FieldGroup>
    </form>
  )
}

function ProfileInput({
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
  name: keyof ManufacturerProfileUpsertRequest
  onBlur: () => void
  onChange: (value: string) => void
  type?: 'email' | 'text'
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
