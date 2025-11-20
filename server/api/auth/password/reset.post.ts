import { createError } from 'h3'
import bcrypt from 'bcryptjs'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { getValidPasswordReset, markPasswordResetUsed } from '~~/server/utils/password-reset'

interface ResetBody {
  token?: string
  password?: string
}

const MIN_PASSWORD_LENGTH = 12

export default defineEventHandler(async (event) => {
  const body = await readBody<ResetBody>(event)
  const token = body.token?.trim() ?? ''
  const password = body.password ?? ''

  if (token.length === 0 || password.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Token and password are required',
    })
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    })
  }

  const reset = getValidPasswordReset(token)
  if (!reset) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid or expired password reset token',
    })
  }

  const db = useDrizzle()
  const user = db
    .select({ id: tables.users.id })
    .from(tables.users)
    .where(eq(tables.users.id, reset.userId))
    .get()

  if (!user) {
    markPasswordResetUsed(reset.id, reset.userId)
    throw createError({
      statusCode: 404,
      statusMessage: 'User for token no longer exists',
    })
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const now = new Date()

  db.update(tables.users)
    .set({ password: hashedPassword, updatedAt: now })
    .where(eq(tables.users.id, user.id))
    .run()

  db.delete(tables.sessions)
    .where(eq(tables.sessions.userId, user.id))
    .run()

  markPasswordResetUsed(reset.id, reset.userId)

  return { success: true }
})
