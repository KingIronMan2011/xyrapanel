import { assertMethod, createError, getValidatedRouterParams, parseCookies } from 'h3'
import { auth, normalizeHeadersForAuth } from '~~/server/utils/auth'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'
import { requireAuth } from '~~/server/utils/security'

export default defineEventHandler(async (event) => {
  assertMethod(event, 'DELETE')

  const session = await requireAuth(event)

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
    headers: normalizeHeadersForAuth(event.node.req.headers),
  })

  if (!result.status) {
    throw createError({ statusCode: 404, statusMessage: 'Session not found or failed to revoke' })
  }

  await recordAuditEventFromRequest(event, {
    actor: session.user.id,
    actorType: 'user',
    action: 'account.session.revoke',
    targetType: 'session',
    targetId: targetToken,
    metadata: {
      isCurrentSession: currentToken === targetToken,
    },
  })

  return {
    revoked: true,
    currentSessionRevoked: currentToken === targetToken,
  }
})
