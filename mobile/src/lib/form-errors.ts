export function formatFormError(error: unknown) {
  if (typeof error === 'string') return translateValidationMessage(error)

  if (error && typeof error === 'object') {
    const code = 'code' in error && typeof error.code === 'string' ? error.code : null
    const message = 'message' in error && typeof error.message === 'string' ? error.message : null

    if (message && (!code || code === 'custom' || hasSpecificValidationMessage(message))) {
      return translateValidationMessage(message)
    }

    if (code) return validationCodeMessage(code)
    if (message) return translateValidationMessage(message)
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
    case 'custom':
      return 'Проверьте значение поля'
    default:
      return 'Проверьте значение поля'
  }
}

function translateValidationMessage(message: string) {
  const exactTranslation = validationMessageTranslations[message]
  if (exactTranslation) return exactTranslation

  const dynamicTranslation = translateDynamicValidationMessage(message)
  if (dynamicTranslation) return dynamicTranslation

  if (message === 'Invalid value') return 'Некорректное значение'
  if (message === 'Required') return 'Обязательное поле'
  if (message.toLowerCase().includes('invalid')) return 'Некорректное значение'
  if (message.toLowerCase().includes('required')) return 'Обязательное поле'
  if (message.toLowerCase().includes('too small')) return 'Значение слишком короткое или маленькое'
  if (message.toLowerCase().includes('too big')) return 'Значение слишком большое'
  return message
}

function hasSpecificValidationMessage(message: string) {
  return (
    message in validationMessageTranslations ||
    translateDynamicValidationMessage(message) !== null ||
    /[А-Яа-яЁё]/.test(message)
  )
}

function translateDynamicValidationMessage(message: string) {
  const rentalPeriodMatch = message.match(/^Rental period must be (\d+) days or less$/)
  if (rentalPeriodMatch) {
    return `Срок аренды должен быть не больше ${rentalPeriodMatch[1]} дней.`
  }

  const reportPeriodMatch = message.match(/^Report period must be (\d+) days or less$/)
  if (reportPeriodMatch) {
    return `Период отчета должен быть не больше ${reportPeriodMatch[1]} дней.`
  }

  return null
}

const validationMessageTranslations: Record<string, string> = {
  'At least one field must be provided': 'Измените хотя бы одно поле.',
  'Bicycle ids must be unique': 'Выберите каждый велосипед только один раз.',
  'Both start and end dates are required and start must be before or equal to end': 'Укажите обе даты. Дата начала должна быть не позже даты окончания.',
  'Checklists are only accepted for issue and return transitions': 'Чеклисты можно отправлять только при выдаче или возврате.',
  'Checklists are required for this order transition': 'Заполните чеклисты для перехода заявки.',
  'Comment is required when cancelling an order': 'Укажите комментарий для отмены заявки.',
  'Date filter is only supported for orders today': 'Фильтр по дате доступен только для заказов на сегодня.',
  'Date filter is required for orders today': 'Для фильтра заказов на сегодня нужна дата.',
  'Delivery address is only allowed for delivery': 'Адрес доставки можно указывать только для доставки.',
  'Delivery address is required for delivery': 'Укажите адрес доставки.',
  'Expected YYYY-MM-DD': 'Укажите дату в формате ГГГГ-ММ-ДД.',
  'Expected a valid calendar date': 'Укажите корректную календарную дату.',
  'Issue checklists cannot change bicycle catalog status': 'При выдаче чеклист не может менять статус велосипеда в каталоге.',
  'Minimum price must be less than or equal to maximum price': 'Минимальная цена должна быть не больше максимальной.',
  'Moderation comment is required for rejected bicycles': 'Укажите комментарий модерации для отклоненного велосипеда.',
  'Moderation comment is required for rejected or blocked profiles': 'Укажите комментарий модерации для отклоненного или заблокированного профиля.',
  'Start date must be before or equal to end date': 'Дата начала должна быть не позже даты окончания.',
  'Status filter cannot be combined with a quick filter': 'Статус нельзя сочетать с быстрым фильтром.',
  'Status must belong to the selected order scope': 'Выберите статус из выбранной группы заявок.',
}
