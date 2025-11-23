import { createError } from 'h3'
import { APIError } from 'better-auth/api'
import { getAuth } from '~~/server/utils/auth'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'
import { requireAdmin, readValidatedBodyWithLimit, BODY_SIZE_LIMITS } from '~~/server/utils/security'
import { suspensionActionSchema } from '#shared/schema/admin/actions'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'User ID is required' })
  }

  const body = await readValidatedBodyWithLimit(
    event,
    suspensionActionSchema,
    BODY_SIZE_LIMITS.SMALL,
  )

  try {
    const auth = getAuth()
    
    if (body.action === 'ban') {
      const reason = (body.reason ?? '').trim()
      
      await auth.api.banUser({
        body: {
          userId,
          banReason: reason.length > 0 ? reason : undefined,
          banExpiresIn: body.banExpiresIn || undefined,
        },
        headers: event.req.headers,
      })

      await recordAuditEventFromRequest(event, {
        actor: session.user.email || session.user.id,
        actorType: 'user',
        action: 'admin.user.banned',
        targetType: 'user',
        targetId: userId,
        metadata: {
          reason: reason.length > 0 ? reason : undefined,
          banExpiresIn: body.banExpiresIn || undefined,
        },
      })

      return {
        success: true,
        banned: true,
        reason: reason.length > 0 ? reason : null,
      }
    }

    if (body.action === 'unban') {
      await auth.api.unbanUser({
        body: {
          userId,
        },
        headers: event.req.headers,
      })

      await recordAuditEventFromRequest(event, {
        actor: session.user.email || session.user.id,
        actorType: 'user',
        action: 'admin.user.unbanned',
        targetType: 'user',
        targetId: userId,
      })

      return {
        success: true,
        banned: false,
      }
    }

    const db = useDrizzle()
    const existing = db
      .select({
        id: tables.users.id,
        username: tables.users.username,
        suspended: tables.users.suspended,
      })
      .from(tables.users)
      .where(eq(tables.users.id, userId))
      .get()

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
    }

    const now = new Date()

    if (body.action === 'suspend') {
      const reason = (body.reason ?? '').trim()

      db.update(tables.users)
        .set({
          suspended: true,
          suspendedAt: now,
          suspensionReason: reason.length > 0 ? reason : null,
          updatedAt: now,
        })
        .where(eq(tables.users.id, userId))
        .run()

      await auth.api.revokeUserSessions({
        body: {
          userId,
        },
        headers: event.req.headers,
      })

      await recordAuditEventFromRequest(event, {
        actor: session.user.email || session.user.id,
        actorType: 'user',
        action: 'admin.user.suspend',
        targetType: 'user',
        targetId: userId,
        metadata: {
          reason: reason.length > 0 ? reason : undefined,
        },
      })

      return {
        success: true,
        suspended: true,
        reason: reason.length > 0 ? reason : null,
      }
    }

    db.update(tables.users)
      .set({
        suspended: false,
        suspendedAt: null,
        suspensionReason: null,
        updatedAt: now,
      })
      .where(eq(tables.users.id, userId))
      .run()

    await recordAuditEventFromRequest(event, {
      actor: session.user.email || session.user.id,
      actorType: 'user',
      action: 'admin.user.unsuspend',
      targetType: 'user',
      targetId: userId,
    })

    return {
      success: true,
      suspended: false,
    }
  }
  catch (error) {
    if (error instanceof APIError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message || 'Failed to perform action',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to perform action',
    })
  }
})
