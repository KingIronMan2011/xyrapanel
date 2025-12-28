import { getServerSession } from '~~/server/utils/session'
import { getServerWithAccess } from '~~/server/utils/server-helpers'
import { useDrizzle, tables, eq, and } from '~~/server/utils/drizzle'
import { invalidateServerCaches } from '~~/server/utils/serversStore'
import { requireServerPermission } from '~~/server/utils/permission-middleware'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const serverId = getRouterParam(event, 'server')
  const allocationId = getRouterParam(event, 'allocation')

  if (!serverId || !allocationId) {
    throw createError({
      statusCode: 400,
      message: 'Server and allocation identifiers are required',
    })
  }

  const { server } = await getServerWithAccess(serverId, session)

  await requireServerPermission(event, {
    serverId: server.id,
    requiredPermissions: ['allocation.update'],
  })

  const db = useDrizzle()
  const [allocation] = db.select()
    .from(tables.serverAllocations)
    .where(
      and(
        eq(tables.serverAllocations.id, allocationId),
        eq(tables.serverAllocations.serverId, server.id)
      )
    )
    .limit(1)
    .all()

  if (!allocation) {
    throw createError({
      statusCode: 404,
      message: 'Allocation not found',
    })
  }

  db.update(tables.servers)
    .set({ allocationId: allocation.id })
    .where(eq(tables.servers.id, server.id))
    .run()

  await recordAuditEventFromRequest(event, {
    actor: session?.user?.email || session?.user?.id || 'unknown',
    actorType: 'user',
    action: 'server.allocation.primary_set',
    targetType: 'server',
    targetId: server.id,
    metadata: {
      allocationId,
      ip: allocation?.ip,
      port: allocation?.port,
    },
  })

  await invalidateServerCaches({ id: server.id, uuid: server.uuid, identifier: server.identifier })

  return {
    object: 'allocation',
    attributes: {
      id: allocation.id,
      ip: allocation.ip,
      ip_alias: allocation.ipAlias,
      port: allocation.port,
      notes: allocation.notes,
      is_default: true,
    },
  }
})
