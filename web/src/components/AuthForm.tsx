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
import { ButtonGroup } from '@/components/ui/button-group'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { ApiRequestError } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/use-auth'

type AuthMode = 'login' | 'register'
type RegistrationRole = RegisterRequest['role']

const registrationRoles: Array<{ label: string; value: RegistrationRole }> = [
  { label: 'User', value: 'user' },
  { label: 'Manufacturer', value: 'manufacturer' },
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
      displayName: '' as string | undefined,
      role: 'user' as RegistrationRole,
    },
    validators: {
      onChange: ({ value }) => {
        const schema = isRegister ? registerRequestSchema : loginRequestSchema
        const result = schema.safeParse(value)
        return result.success ? undefined : result.error.issues
      },
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
          setError(caughtError.message)
          return
        }
        setError('Unexpected auth error')
      }
    },
  })

  return (
    <Card aria-label="Authentication">
      <CardHeader>
        <h2 className="font-heading text-base leading-snug font-medium">
          {isRegister ? 'Create account' : 'Login'}
        </h2>
        <CardDescription>
          {isRegister ? 'Start a new browser session.' : 'Continue with an existing account.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ButtonGroup
          className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
          aria-label="Auth mode"
        >
          {(['register', 'login'] as const).map((nextMode) => (
            <Button
              key={nextMode}
              type="button"
              variant={mode === nextMode ? 'outline' : 'ghost'}
              className={cn(
                'h-10 bg-transparent',
                mode === nextMode && 'bg-background shadow-sm',
              )}
              aria-pressed={mode === nextMode}
              onClick={() => {
                setError(null)
                setMode(nextMode)
              }}
            >
              {nextMode === 'register' ? 'Register' : 'Login'}
            </Button>
          ))}
        </ButtonGroup>

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
                      <FieldLabel>Account type</FieldLabel>
                      <ButtonGroup
                        className="grid w-full grid-cols-2 rounded-lg bg-muted p-1"
                        aria-label="Account type"
                      >
                        {registrationRoles.map((role) => (
                          <Button
                            key={role.value}
                            type="button"
                            variant={field.state.value === role.value ? 'outline' : 'ghost'}
                            className={cn(
                              'h-10 bg-transparent',
                              field.state.value === role.value && 'bg-background shadow-sm',
                            )}
                            aria-pressed={field.state.value === role.value}
                            onClick={() => field.handleChange(role.value)}
                          >
                            {role.label}
                          </Button>
                        ))}
                      </ButtonGroup>
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
                      <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                      <Input
                        className="h-11"
                        id={field.name}
                        name={field.name}
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
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    className="h-11"
                    id={field.name}
                    name={field.name}
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
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    className="h-11"
                    id={field.name}
                    name={field.name}
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
                <AlertTitle>Authentication failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting] as const}
              children={([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  className="h-11 w-full"
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? 'Working...' : isRegister ? 'Create account' : 'Login'}
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
