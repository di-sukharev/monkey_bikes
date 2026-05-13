const redirectBaseUrl = 'http://web-app.local'

export function sanitizeRedirectTo(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const redirectTo = value.trim()

  if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
    return null
  }

  try {
    const url = new URL(redirectTo, redirectBaseUrl)
    if (url.origin !== redirectBaseUrl) {
      return null
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}
