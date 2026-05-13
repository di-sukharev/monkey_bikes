import { useForm } from '@tanstack/react-form'
import {
  loginRequestSchema,
  registerRequestSchema,
  type LoginRequest,
  type RegisterRequest,
} from '@web-app-demo/contracts'
import { CircleAlertIcon } from 'lucide-react'
import { useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SegmentedControl } from '@/components/segmented-control'
import { ApiRequestError } from '@/lib/api'
import { formatFormError } from '@/lib/form-errors'
import { formatRequestError } from '@/lib/request-error'
import { useAuth } from '@/lib/use-auth'
import { createFormSchemaValidator } from '@/lib/form-schema-validator'

type AuthMode = 'login' | 'register'
type RegistrationRole = NonNullable<RegisterRequest['role']>

const authModes: Array<{ label: string; value: AuthMode }> = [
  { label: 'Регистрация', value: 'register' },
  { label: 'Вход', value: 'login' },
]

const registrationRoles: Array<{ label: string; value: RegistrationRole }> = [
  { label: 'Клиент', value: 'user' },
  { label: 'Производитель', value: 'manufacturer' },
]

export function AuthForm() {
  const auth = useAuth()
  const [mode, setMode] = useState<AuthMode>('register')
  const [error, setError] = useState<string | null>(null)
  const isRegister = mode === 'register'

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      role: 'user' as RegistrationRole,
    } as {
      email: string
      password: string
      displayName?: string
      role?: RegistrationRole
    },
    validators: {
      onSubmit: ({ value }) => createFormSchemaValidator(isRegister ? registerRequestSchema : loginRequestSchema)({ value }),
    },
    onSubmit: async ({ value }) => {
      setError(null)

      try {
        if (isRegister) {
          await auth.register(registerRequestSchema.parse(value) as RegisterRequest)
        } else {
          await auth.login(loginRequestSchema.parse(value) as LoginRequest)
        }
      } catch (caughtError) {
        if (caughtError instanceof ApiRequestError) {
          setError(formatRequestError(caughtError))
          return
        }
        setError('Неожиданная ошибка авторизации')
      }
    },
  })

  return (
    <Card aria-label="Авторизация">
      <CardHeader>
        <h2 className="font-heading text-base leading-snug font-medium">
          {isRegister ? 'Создать аккаунт' : 'Войти'}
        </h2>
        <CardDescription>
          {isRegister ? 'Начните новую браузерную сессию.' : 'Продолжите с существующим аккаунтом.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <SegmentedControl
          aria-label="Режим авторизации"
          options={authModes}
          value={mode}
          onValueChange={(nextMode) => {
            setError(null)
            setMode(nextMode)
          }}
        />

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          <FieldGroup>
            {isRegister && (
              <>
                <form.Field
                  name="role"
                  children={(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLabel>Тип аккаунта</FieldLabel>
                      <SegmentedControl
                        aria-label="Тип аккаунта"
                        options={registrationRoles}
                        value={field.state.value ?? 'user'}
                        onValueChange={(role) => field.handleChange(role)}
                      />
                      <FieldErrors
                        id={fieldErrorId(field.name, field.state.meta.errors)}
                        errors={field.state.meta.errors}
                      />
                    </Field>
                  )}
                />

                <form.Field
                  name="displayName"
                  children={(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLabel htmlFor={field.name}>Имя</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        size="lg"
                        value={field.state.value ?? ''}
                        autoComplete="name"
                        aria-invalid={field.state.meta.errors.length > 0}
                        aria-describedby={fieldErrorId(field.name, field.state.meta.errors)}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                      />
                      <FieldErrors
                        id={fieldErrorId(field.name, field.state.meta.errors)}
                        errors={field.state.meta.errors}
                      />
                    </Field>
                  )}
                />
              </>
            )}

            <form.Field
              name="email"
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor={field.name}>Электронная почта</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    size="lg"
                    value={field.state.value}
                    type="text"
                    inputMode="email"
                    autoComplete="email"
                    aria-invalid={field.state.meta.errors.length > 0}
                    aria-describedby={fieldErrorId(field.name, field.state.meta.errors)}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldErrors
                    id={fieldErrorId(field.name, field.state.meta.errors)}
                    errors={field.state.meta.errors}
                  />
                </Field>
              )}
            />

            <form.Field
              name="password"
              children={(field) => (
                <Field data-invalid={field.state.meta.errors.length > 0}>
                  <FieldLabel htmlFor={field.name}>Пароль</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    size="lg"
                    value={field.state.value}
                    type="password"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    aria-invalid={field.state.meta.errors.length > 0}
                    aria-describedby={fieldErrorId(field.name, field.state.meta.errors)}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                  <FieldErrors
                    id={fieldErrorId(field.name, field.state.meta.errors)}
                    errors={field.state.meta.errors}
                  />
                </Field>
              )}
            />

            {error && (
              <Alert variant="destructive">
                <CircleAlertIcon />
                <AlertTitle>Не удалось авторизоваться</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form.Subscribe
              selector={(state) => state.isSubmitting}
              children={(isSubmitting) => (
                <Button
                  type="submit"
                  fullWidth
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Выполняется...' : isRegister ? 'Создать аккаунт' : 'Войти'}
                </Button>
              )}
            />
            </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}

function FieldErrors({ errors, id }: { errors: unknown[]; id: string | undefined }) {
  if (!errors.length) return null

  return <FieldError id={id}>{errors.map(formatFormError).join(', ')}</FieldError>
}

function fieldErrorId(fieldName: string, errors: unknown[]) {
  return errors.length > 0 ? `${fieldName}-error` : undefined
}
