import { createError, getRequestURL } from 'h3'
import { APIError } from 'better-auth/api'
import { getAuth } from '~~/server/utils/auth'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = getAuth()
  
  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Admin privileges required' })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'User ID is required' })
  }

  if (userId === session.user.id) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Cannot impersonate yourself' })
  }

  const db = useDrizzle()
  const user = db
    .select({
      id: tables.users.id,
      username: tables.users.username,
      suspended: tables.users.suspended,
      banned: tables.users.banned,
    })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get()

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
  }

  if (user.suspended || user.banned) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Cannot impersonate a suspended or banned user' })
  }

  try {
    const result = await auth.api.impersonateUser({
      body: {
        userId,
      },
      headers: event.req.headers,
    })

    await recordAuditEventFromRequest(event, {
      actor: session.user.email || session.user.id,
      actorType: 'user',
      action: 'admin.user.impersonate',
      targetType: 'user',
      targetId: userId,
      metadata: {
        username: user.username,
      },
    })

    const runtimeConfig = useRuntimeConfig()
    const requestUrl = getRequestURL(event)
    const baseUrl = runtimeConfig.public?.panelBaseUrl || requestUrl.origin

    return {
      success: true,
      impersonateUrl: `${baseUrl}/auth/impersonate?token=${result.token || ''}`,
      expiresAt: result.expiresAt || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }
  }
  catch (error) {
    if (error instanceof APIError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message || 'Failed to impersonate user',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to impersonate user',
    })
  }
})
