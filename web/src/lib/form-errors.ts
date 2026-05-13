export function formatFormError(error: unknown) {
  if (typeof error === 'string') return translateValidationMessage(error)

  if (error && typeof error === 'object') {
    if ('code' in error && typeof error.code === 'string') {
      return validationCodeMessage(error.code)
    }

    if ('message' in error && typeof error.message === 'string') {
      return translateValidationMessage(error.message)
    }
  }

  return 'Некорректное значение'
}

function validationCodeMessage(code: string) {
  switch (code) {
    case 'invalid_format':
    case 'invalid_string':
      return 'Некорректный формат'
    case 'invalid_type':
      return 'Заполните поле корректным значением'
    case 'too_big':
      return 'Значение слишком большое'
    case 'too_small':
      return 'Значение слишком короткое или маленькое'
    case 'unrecognized_keys':
      return 'Есть неподдерживаемые поля'
    default:
      return 'Проверьте значение поля'
  }
}

function translateValidationMessage(message: string) {
  if (message === 'Invalid value') return 'Некорректное значение'
  if (message === 'Required') return 'Обязательное поле'
  if (message.toLowerCase().includes('invalid')) return 'Некорректное значение'
  if (message.toLowerCase().includes('required')) return 'Обязательное поле'
  if (message.toLowerCase().includes('too small')) return 'Значение слишком короткое или маленькое'
  if (message.toLowerCase().includes('too big')) return 'Значение слишком большое'
  return message
}
