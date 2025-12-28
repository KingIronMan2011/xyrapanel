import { getServerSession } from '~~/server/utils/session'
import { getServerWithAccess } from '~~/server/utils/server-helpers'
import { useDrizzle, tables, eq, and } from '~~/server/utils/drizzle'
import { invalidateServerSubusersCache } from '~~/server/utils/subusers'
import { requireServerPermission } from '~~/server/utils/permission-middleware'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const serverId = getRouterParam(event, 'server')
  const subuserId = getRouterParam(event, 'user')

  if (!serverId || !subuserId) {
    throw createError({
      statusCode: 400,
      message: 'Server and user identifiers are required',
    })
  }

  const { server } = await getServerWithAccess(serverId, session)

  await requireServerPermission(event, {
    serverId: server.id,
    requiredPermissions: ['server.users.delete'],
  })

  const db = useDrizzle()
  const subuser = db
    .select()
    .from(tables.serverSubusers)
    .where(
      and(
        eq(tables.serverSubusers.id, subuserId),
        eq(tables.serverSubusers.serverId, server.id)
      )
    )
    .get()

  if (!subuser) {
    throw createError({
      statusCode: 404,
      message: 'Subuser not found',
    })
  }

  db.delete(tables.serverSubusers)
    .where(eq(tables.serverSubusers.id, subuserId))
    .run()

  await recordAuditEventFromRequest(event, {
    actor: session?.user?.email || session?.user?.id || 'unknown',
    actorType: 'user',
    action: 'server.user.deleted',
    targetType: 'user',
    targetId: subuser.userId,
    metadata: {
      serverId: server.id,
      subuserId,
    },
  })

  await invalidateServerSubusersCache(server.id, [subuser.userId])

  return {
    success: true,
  }
})
