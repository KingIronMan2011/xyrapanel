import { createError } from 'h3'
import { APIError } from 'better-auth/api'
import { getAuth } from '~~/server/utils/auth'
import { requireAuth, readValidatedBodyWithLimit, BODY_SIZE_LIMITS } from '~~/server/utils/security'
import { accountProfileUpdateSchema } from '#shared/schema/account'

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event)
  const auth = getAuth()

  const body = await readValidatedBodyWithLimit(
    event,
    (payload) => accountProfileUpdateSchema.parse(payload),
    BODY_SIZE_LIMITS.SMALL,
  )

  try {
    if (body.username !== undefined) {
      await auth.api.updateUser({
        body: {
          username: body.username,
        },
        headers: event.req.headers,
      })
    }

    if (body.email !== undefined && body.email !== session.user.email) {
      await auth.api.changeEmail({
        body: {
          newEmail: body.email,
        },
        headers: event.req.headers,
      })
    }

    const updatedSession = await auth.api.getSession({
      headers: event.req.headers,
    })

    if (!updatedSession?.user) {
      throw createError({ statusCode: 404, statusMessage: 'User not found after update' })
    }

    return {
      data: {
        id: updatedSession.user.id,
        username: updatedSession.user.username || body.username,
        email: updatedSession.user.email || body.email,
        role: (updatedSession.user as { role?: string }).role || 'user',
      },
    }
  }
  catch (error) {
    if (error instanceof APIError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message || 'Unable to update profile',
      })
    }
    throw createError({
      statusCode: 400,
      statusMessage: 'Unable to update profile',
    })
  }
})
