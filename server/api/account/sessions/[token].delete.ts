import { assertMethod, createError, getValidatedRouterParams, parseCookies } from 'h3'
import { auth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  assertMethod(event, 'DELETE')

  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const { token: targetToken } = await getValidatedRouterParams(event, (params) => {
    const tokenParam = (params as Record<string, unknown>).token
    if (typeof tokenParam !== 'string' || tokenParam.trim().length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Missing session token' })
    }

    return { token: tokenParam }
  })

  const cookies = parseCookies(event)
  const currentToken = cookies['better-auth.session_token']

  const result = await auth.api.revokeSession({
    body: { token: targetToken },
    headers: event.req.headers,
  })

  if (!result.status) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found or failed to revoke' })
  }

  return {
    revoked: true,
    currentSessionRevoked: currentToken === targetToken,
  }
})
