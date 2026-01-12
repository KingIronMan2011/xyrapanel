import { createError } from 'h3'
import { getServerSession } from '~~/server/utils/session'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { resolveSessionUser } from '~~/server/utils/auth/sessionUser'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const resolvedUser = resolveSessionUser(session)

  if (!resolvedUser?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const db = useDrizzle()

  const user = db
    .select({
      id: tables.users.id,
      username: tables.users.username,
      email: tables.users.email,
      role: tables.users.role,
    })
    .from(tables.users)
    .where(eq(tables.users.id, resolvedUser.id))
    .get()

  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }

  await recordAuditEventFromRequest(event, {
    actor: resolvedUser.id,
    actorType: 'user',
    action: 'account.profile.viewed',
    targetType: 'user',
    targetId: resolvedUser.id,
  })

  return { data: user }
})
