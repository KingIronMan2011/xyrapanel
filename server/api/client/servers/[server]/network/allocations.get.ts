import { getServerSession } from '~~/server/utils/session'
import { getServerWithAccess } from '~~/server/utils/server-helpers'
import { listServerAllocations } from '~~/server/utils/serversStore'
import { requireServerPermission } from '~~/server/utils/permission-middleware'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const serverId = getRouterParam(event, 'server')

  if (!serverId) {
    throw createError({
      statusCode: 400,
      message: 'Server identifier is required',
    })
  }

  const { server } = await getServerWithAccess(serverId, session)

  await requireServerPermission(event, {
    serverId: server.id,
    requiredPermissions: ['allocation.read'],
  })

  const allocations = await listServerAllocations(server.id)

  return {
    data: allocations.map(alloc => ({
      id: alloc.id,
      ip: alloc.ip,
      port: alloc.port,
      ip_alias: alloc.ipAlias,
      is_primary: alloc.isPrimary,
      notes: alloc.notes,
      assigned: true,
    })),
  }
})
