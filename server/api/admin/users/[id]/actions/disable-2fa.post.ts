import { createError } from 'h3'
import { APIError } from 'better-auth/api'
import { getAuth } from '~~/server/utils/auth'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'
import { requireAdmin } from '~~/server/utils/security'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const auth = getAuth()

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'User ID is required' })
  }

  const db = useDrizzle()

  const existing = db
    .select({
      id: tables.users.id,
      username: tables.users.username,
      twoFactorEnabled: tables.users.twoFactorEnabled,
    })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
  }

  try {
    await auth.api.adminUpdateUser({
      body: {
        userId,
        data: {
          twoFactorEnabled: false,
        },
      },
      headers: event.req.headers,
    })

    db.delete(tables.twoFactor)
      .where(eq(tables.twoFactor.userId, userId))
      .run()

    await recordAuditEventFromRequest(event, {
      actor: session.user.email || session.user.id,
      actorType: 'user',
      action: 'admin.user.disable_2fa',
      targetType: 'user',
      targetId: userId,
    })

    return {
      success: true,
      message: existing.twoFactorEnabled
        ? 'Two-factor authentication has been disabled for the user.'
        : 'Two-factor authentication was already disabled.',
    }
  }
  catch (error) {
    if (error instanceof APIError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message || 'Failed to disable 2FA',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to disable 2FA',
    })
  }
})
