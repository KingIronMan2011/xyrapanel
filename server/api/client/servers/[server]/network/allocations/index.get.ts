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
    object: 'list',
    data: allocations.map(alloc => ({
      object: 'allocation',
      attributes: {
        id: alloc.id,
        ip: alloc.ip,
        ip_alias: alloc.ipAlias,
        port: alloc.port,
        notes: alloc.notes,
        is_default: alloc.id === server.allocationId,
      },
    })),
  }
})
