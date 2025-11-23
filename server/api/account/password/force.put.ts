import { assertMethod, createError, readValidatedBody } from 'h3'
import { getServerSession } from '~~/server/utils/session'
import bcrypt from 'bcryptjs'

import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { resolveSessionUser } from '~~/server/utils/auth/sessionUser'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'
import { accountForcedPasswordSchema } from '#shared/schema/account'

export default defineEventHandler(async (event) => {
  assertMethod(event, 'PUT')

  const session = await getServerSession(event)
  const user = resolveSessionUser(session)

  if (!user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readValidatedBody(event, payload => accountForcedPasswordSchema.parse(payload))

  const db = useDrizzle()

  const existing = db
    .select({ password: tables.users.password, passwordResetRequired: tables.users.passwordResetRequired })
    .from(tables.users)
    .where(eq(tables.users.id, user.id))
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
  }

  if (!existing.passwordResetRequired) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Password reset not required' })
  }

  const isSamePassword = await bcrypt.compare(body.newPassword, existing.password)
  if (isSamePassword) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Choose a different password' })
  }

  const hashedPassword = await bcrypt.hash(body.newPassword, 12)
  const now = new Date()

  db.update(tables.users)
    .set({
      password: hashedPassword,
      passwordResetRequired: false,
      updatedAt: now,
    })
    .where(eq(tables.users.id, user.id))
    .run()

  const revokedSessions = db.delete(tables.sessions)
    .where(eq(tables.sessions.userId, user.id))
    .run()

  const revokedCount = typeof revokedSessions.changes === 'number' ? revokedSessions.changes : 0

  await recordAuditEventFromRequest(event, {
    actor: user.email || user.id,
    actorType: 'user',
    action: 'account.password.force_update',
    targetType: 'user',
    targetId: user.id,
    metadata: {
      revokedSessions: revokedCount,
    },
  })

  return {
    success: true,
    revokedSessions: revokedCount,
  }
})
