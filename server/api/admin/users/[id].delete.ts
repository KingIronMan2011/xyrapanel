import { createError } from 'h3'
import { APIError } from 'better-auth/api'
import { getAuth } from '~~/server/utils/auth'
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
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Admin access required' })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'User ID is required' })
  }

  if (userId === session.user.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Cannot delete your own account',
    })
  }

  try {
    await auth.api.removeUser({
      body: {
        userId,
      },
      headers: event.req.headers,
    })

    await recordAuditEventFromRequest(event, {
      actor: session.user.email || session.user.id,
      actorType: 'user',
      action: 'admin.user.deleted',
      targetType: 'user',
      targetId: userId,
    })

    return { success: true }
  }
  catch (error) {
    if (error instanceof APIError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message || 'Failed to remove user',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to remove user',
    })
  }
})
