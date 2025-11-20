import { createError } from 'h3'
import { useDrizzle, tables, eq, or } from '~~/server/utils/drizzle'
import { createPasswordResetToken } from '~~/server/utils/password-reset'
import { sendPasswordResetEmail, resolvePanelBaseUrl } from '~~/server/utils/email'

interface RequestBody {
  identity?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RequestBody>(event)

  const identity = body.identity?.trim().toLowerCase()

  if (!identity) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username or email required',
    })
  }

  const db = useDrizzle()

  const user = db
    .select({ id: tables.users.id, email: tables.users.email })
    .from(tables.users)
    .where(or(eq(tables.users.email, identity), eq(tables.users.username, identity)))
    .get()

  if (user?.email) {
    try {
      const { token } = await createPasswordResetToken(user.id)
      const resetBaseUrl = `${resolvePanelBaseUrl()}/auth/password/reset`
      await sendPasswordResetEmail(user.email, token, resetBaseUrl)
    }
    catch (error) {
      console.error('Failed to send password reset email', error)
    }
  }

  return {
    success: true,
    message: 'If an account matches, a password reset email has been sent.',
  }
})
