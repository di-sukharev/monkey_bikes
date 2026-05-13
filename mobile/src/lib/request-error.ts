import { ApiRequestError } from '@/lib/api'

export function formatRequestError(error: unknown) {
  if (error instanceof ApiRequestError) return apiErrorMessage(error)
  if (error instanceof Error) return 'Не удалось выполнить запрос. Проверьте соединение и повторите попытку.'
  return 'Неожиданная ошибка запроса'
}

function apiErrorMessage(error: ApiRequestError) {
  return translateApiErrorMessage(error.message) ?? apiErrorCodeMessage(error.code)
}

function apiErrorCodeMessage(code: string) {
  switch (code) {
    case 'BAD_REQUEST':
      return 'Некорректный запрос.'
    case 'UNAUTHORIZED':
      return 'Войдите в аккаунт и повторите попытку.'
    case 'FORBIDDEN':
      return 'У аккаунта нет прав для этого действия.'
    case 'NOT_FOUND':
      return 'Запись не найдена.'
    case 'CONFLICT':
      return 'Действие конфликтует с текущим состоянием данных.'
    case 'ORDER_AVAILABILITY_CONFLICT':
      return 'Выбранные велосипеды недоступны на эти даты.'
    case 'ORDER_NOT_CANCELLABLE':
      return 'Эту заявку уже нельзя отменить.'
    case 'ORDER_STATUS_TRANSITION_NOT_ALLOWED':
      return 'Этот переход статуса сейчас недоступен.'
    case 'BICYCLE_NOT_AVAILABLE':
      return 'Велосипед сейчас недоступен.'
    case 'PAYMENT_ACTIVE_ATTEMPT_EXISTS':
      return 'У этого платежа уже есть активная попытка.'
    case 'PAYMENT_DEV_ENDPOINTS_DISABLED':
      return 'Тестовое завершение платежей отключено в этом окружении.'
    case 'PAYMENT_NOT_ALLOWED':
      return 'Платежи для этой заявки сейчас недоступны.'
    case 'PAYMENT_NOT_COMPLETABLE':
      return 'Эту платежную попытку нельзя завершить.'
    case 'PAYMENT_NOT_FOUND':
      return 'Платеж не найден.'
    case 'PAYMENT_PROVIDER_DISABLED':
      return 'Платежный провайдер отключен.'
    case 'CHECKLIST_BICYCLE_MISMATCH':
      return 'Чеклист содержит велосипед не из этой заявки.'
    case 'CHECKLIST_REQUIRED':
      return 'Для перехода нужен чеклист по каждому велосипеду.'
    case 'PAYMENT_REQUIREMENTS_NOT_MET':
      return 'Перед выдачей нужно успешно оплатить аренду и залог.'
    case 'VALIDATION_ERROR':
      return 'Проверьте введенные данные.'
    case 'INTERNAL_ERROR':
    default:
      return 'Внутренняя ошибка сервера.'
  }
}

function translateApiErrorMessage(message: string) {
  const trimmedMessage = message.trim()
  const translated = apiErrorMessageTranslations[trimmedMessage]

  if (translated) return translated
  const patternTranslated = translateApiErrorMessagePattern(trimmedMessage)
  if (patternTranslated) return patternTranslated
  if (shouldPreserveApiErrorMessage(trimmedMessage)) return trimmedMessage

  return null
}

function shouldPreserveApiErrorMessage(message: string) {
  if (!message) return false
  if (/^Request failed with status \d+$/.test(message)) return false
  if (message === 'Invalid request payload') return false
  if (message === 'Unexpected server error') return false

  return /[А-Яа-яЁё]/.test(message)
}

function translateApiErrorMessagePattern(message: string) {
  const rentalPeriodMatch = message.match(/^Rental period must be (\d+) days or less$/)
  if (rentalPeriodMatch) {
    return `Срок аренды должен быть не больше ${rentalPeriodMatch[1]} дней.`
  }

  const amountLimitMatch = message.match(
    /^(Rental amount|Deposit amount|Delivery amount|Total amount) exceeds the maximum supported amount$/,
  )
  if (amountLimitMatch) {
    return amountLimitTranslations[amountLimitMatch[1] as keyof typeof amountLimitTranslations]
  }

  return null
}

const apiErrorMessageTranslations: Record<string, string> = {
  'Access token is invalid or expired': 'Сессия истекла. Войдите снова.',
  'Access token is required': 'Войдите в аккаунт и повторите попытку.',
  'Admin cannot remove their own admin access': 'Администратор не может снять собственные права администратора.',
  'All bicycles must be available for rental requests': 'Все выбранные велосипеды должны быть доступны для аренды.',
  'Approved manufacturer profile is required': 'Для этого действия нужен одобренный профиль производителя.',
  'Approved manufacturer profile must be edited before resubmission': 'Одобренный профиль производителя нужно отредактировать перед повторной отправкой.',
  'Archived bicycle cannot change status': 'Архивному велосипеду нельзя изменить статус.',
  'Archived bicycle cannot be submitted': 'Архивный велосипед нельзя отправить на модерацию.',
  'At least one active admin is required': 'Нужен хотя бы один активный администратор.',
  'Available bicycle must be edited before resubmission': 'Доступный велосипед нужно отредактировать перед повторной отправкой.',
  'Bicycle cannot be submitted from its current status': 'Велосипед нельзя отправить на модерацию из текущего статуса.',
  'Bicycle is already waiting for moderation': 'Велосипед уже ожидает модерации.',
  'Bicycle not found': 'Велосипед не найден.',
  'Bicycle state does not allow manufacturer changes': 'Текущий статус велосипеда не позволяет производителю менять карточку.',
  'Bicycle state does not allow this status change': 'Текущий статус велосипеда не позволяет такой переход.',
  'Blocked manufacturer profile cannot be submitted': 'Заблокированный профиль производителя нельзя отправить на модерацию.',
  'Blocked manufacturer profile cannot be changed': 'Заблокированный профиль производителя нельзя изменить.',
  'Checklist bicycle must belong to this order': 'Чеклист должен относиться к велосипеду из этой заявки.',
  'Concurrent order status update conflict': 'Заказ уже изменился. Обновите страницу и повторите действие.',
  'Concurrent payment update conflict': 'Платеж уже изменился. Обновите страницу и повторите действие.',
  'Concurrent user update conflict': 'Пользователь уже изменился. Обновите страницу и повторите действие.',
  'Delivery is not available for every selected bicycle': 'Доставка доступна не для всех выбранных велосипедов.',
  'Exactly one checklist is required for every order bicycle': 'Для каждого велосипеда в заказе нужен ровно один чеклист.',
  'Failed or cancelled payments require a new attempt': 'Для неуспешного или отмененного платежа нужна новая попытка.',
  'Insufficient permissions': 'У аккаунта нет прав для этого действия.',
  'Invalid email or password': 'Адрес электронной почты или пароль неверные.',
  'Manufacturer profile cannot be changed from its current status': 'Профиль производителя нельзя изменить из текущего статуса.',
  'Manufacturer profile cannot be submitted from its current status': 'Профиль производителя нельзя отправить на модерацию из текущего статуса.',
  'Manufacturer profile is already blocked': 'Профиль производителя уже заблокирован.',
  'Manufacturer profile is already waiting for moderation': 'Профиль производителя уже ожидает модерации.',
  'Manufacturer profile is required before submission': 'Перед отправкой на модерацию заполните профиль производителя.',
  'Manufacturer profile not found': 'Профиль производителя не найден.',
  'Manufacturer profile must be approved to manage bicycles': 'Управлять велосипедами можно только после одобрения профиля производителя.',
  'Only bicycles waiting for moderation can be reviewed': 'Рассматривать можно только велосипеды, ожидающие модерации.',
  'Only confirmed orders can be issued': 'Выдать можно только подтвержденную заявку.',
  'Only issued orders can be returned': 'Вернуть можно только выданную заявку.',
  'Only profiles waiting for moderation can be approved or rejected': 'Одобрить или отклонить можно только профили, ожидающие модерации.',
  'Only rental requests can be cancelled by the customer': 'Клиент может отменить только новую заявку.',
  'Only rental requests can be confirmed': 'Подтвердить можно только новую заявку.',
  'Only rental requests or confirmed orders can be cancelled by an administrator in this flow': 'В этом сценарии администратор может отменить только новую или подтвержденную заявку.',
  'Order not found': 'Заказ не найден.',
  'Order status changed before it could be cancelled': 'Статус заявки изменился до отмены. Обновите страницу и повторите действие.',
  'Order status changed before it could be confirmed': 'Статус заявки изменился до подтверждения. Обновите страницу и повторите действие.',
  'Order status changed before it could be issued': 'Статус заявки изменился до выдачи. Обновите страницу и повторите действие.',
  'Order status changed before it could be returned': 'Статус заявки изменился до возврата. Обновите страницу и повторите действие.',
  'Payment amount exceeds the maximum supported amount': 'Сумма платежа превышает поддерживаемый максимум.',
  'Payment not found': 'Платеж не найден.',
  'Payments can only be created for confirmed orders': 'Платежи можно создать только для подтвержденных заказов.',
  'Refresh session is invalid or expired': 'Сессия истекла. Войдите снова.',
  'Refresh token is required': 'Войдите в аккаунт и повторите попытку.',
  'Rent and deposit payments must be successful before issuing the order': 'Перед выдачей нужно успешно оплатить аренду и залог.',
  'Report aggregate exceeds safe integer range': 'Агрегат отчета превышает безопасный числовой диапазон.',
  'Route not found': 'Маршрут не найден.',
  'Session is invalid or expired': 'Сессия истекла. Войдите снова.',
  'Selected bicycles are no longer available for confirmation': 'Выбранные велосипеды больше нельзя подтвердить для аренды.',
  'Selected bicycles are no longer available for issuance': 'Выбранные велосипеды больше нельзя выдать.',
  'Selected bicycles are no longer marked as rented for return': 'Выбранные велосипеды больше не числятся выданными для возврата.',
  'Selected bicycles are unavailable for these dates': 'Выбранные велосипеды недоступны на эти даты.',
  'Succeeded payments cannot be changed by stub endpoints': 'Успешный платеж нельзя изменить через тестовый обработчик.',
  'Stub payment completion endpoints are disabled': 'Тестовое завершение платежей отключено в этом окружении.',
  'Stub payment provider is disabled': 'Платежный провайдер отключен.',
  'User is blocked': 'Пользователь заблокирован.',
  'User not found': 'Пользователь не найден.',
  'User with this email already exists': 'Пользователь с такой электронной почтой уже существует.',
}

const amountLimitTranslations = {
  'Rental amount': 'Стоимость аренды превышает поддерживаемый максимум.',
  'Deposit amount': 'Сумма залога превышает поддерживаемый максимум.',
  'Delivery amount': 'Стоимость доставки превышает поддерживаемый максимум.',
  'Total amount': 'Итоговая сумма превышает поддерживаемый максимум.',
}
