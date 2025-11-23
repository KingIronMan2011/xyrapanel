import { createError } from 'h3'
import { APIError } from 'better-auth/api'
import { getAuth } from '~~/server/utils/auth'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'
import { requireAdmin, readValidatedBodyWithLimit, BODY_SIZE_LIMITS } from '~~/server/utils/security'
import { z } from 'zod'

const emailVerificationActionSchema = z.object({
  action: z.enum(['mark-verified', 'mark-unverified', 'resend-link']),
})

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const auth = getAuth()

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'User ID is required' })
  }

  const body = await readValidatedBodyWithLimit(
    event,
    emailVerificationActionSchema,
    BODY_SIZE_LIMITS.SMALL,
  )

  const db = useDrizzle()

  const user = db
    .select({
      id: tables.users.id,
      email: tables.users.email,
      username: tables.users.username,
    })
    .from(tables.users)
    .where(eq(tables.users.id, userId))
    .get()

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
  }

  try {
    switch (body.action) {
      case 'mark-verified': {
        await auth.api.adminUpdateUser({
          body: {
            userId,
            data: {
              emailVerified: new Date(),
            },
          },
          headers: event.req.headers,
        })
        break
      }
      case 'mark-unverified': {
        await auth.api.adminUpdateUser({
          body: {
            userId,
            data: {
              emailVerified: null,
            },
          },
          headers: event.req.headers,
        })
        break
      }
      case 'resend-link': {
        if (!user.email) {
          throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'User is missing an email address' })
        }

        const { sendEmailVerificationEmail } = await import('~~/server/utils/email')
        const { createEmailVerificationToken } = await import('~~/server/utils/email-verification')
        
        const { token, expiresAt } = await createEmailVerificationToken(user.id)
        await sendEmailVerificationEmail({
          to: user.email,
          token,
          expiresAt,
          username: user.username,
        })
        break
      }
    }

    await recordAuditEventFromRequest(event, {
      actor: session.user.email || session.user.id,
      actorType: 'user',
      action: `admin.user.email.${body.action}`,
      targetType: 'user',
      targetId: userId,
    })

    return {
      success: true,
      action: body.action,
    }
  }
  catch (error) {
    if (error instanceof APIError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message || 'Failed to perform email verification action',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to perform email verification action',
    })
  }
})
