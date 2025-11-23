import { createError, assertMethod } from 'h3'
import { APIError } from 'better-auth/api'
import { getAuth } from '~~/server/utils/auth'
import { getServerSession } from '~~/server/utils/session'
import { resolveSessionUser } from '~~/server/utils/auth/sessionUser'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'
import { accountPasswordUpdateSchema } from '#shared/schema/account'

export default defineEventHandler(async (event) => {
  assertMethod(event, 'PUT')

  const auth = getAuth()
  
  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readValidatedBody(event, payload => accountPasswordUpdateSchema.parse(payload))

  try {
    const result = await auth.api.changePassword({
      body: {
        currentPassword: body.currentPassword,
        newPassword: body.newPassword,
        revokeOtherSessions: true,
      },
      headers: event.req.headers,
    })

    const resolvedUser = resolveSessionUser(await getServerSession(event))
    if (resolvedUser) {
      await recordAuditEventFromRequest(event, {
        actor: resolvedUser.email || resolvedUser.id,
        actorType: 'user',
        action: 'account.password.update',
        targetType: 'user',
        targetId: resolvedUser.id,
        metadata: {
          revokedSessions: result.revokedSessions || 0,
        },
      })
    }

    return {
      success: true,
      revokedSessions: result.revokedSessions || 0,
    }
  }
  catch (error) {
    if (error instanceof APIError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message || 'Failed to change password',
      })
    }
    throw createError({
      statusCode: 400,
      statusMessage: 'Failed to change password',
    })
  }
})
