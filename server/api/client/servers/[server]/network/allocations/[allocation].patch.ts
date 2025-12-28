import { getServerSession } from '~~/server/utils/session'
import { getServerWithAccess } from '~~/server/utils/server-helpers'
import { useDrizzle, tables, eq, and } from '~~/server/utils/drizzle'
import { readValidatedBodyWithLimit, BODY_SIZE_LIMITS } from '~~/server/utils/security'
import { updateAllocationSchema } from '#shared/schema/server/subusers'
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

  const body = await readValidatedBodyWithLimit(
    event,
    updateAllocationSchema,
    BODY_SIZE_LIMITS.SMALL,
  )

  const db = useDrizzle()
  const allocation = db
    .select()
    .from(tables.serverAllocations)
    .where(
      and(
        eq(tables.serverAllocations.id, allocationId),
        eq(tables.serverAllocations.serverId, server.id)
      )
    )
    .get()

  if (!allocation) {
    throw createError({
      statusCode: 404,
      message: 'Allocation not found',
    })
  }

  db.update(tables.serverAllocations)
    .set({
      notes: body.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(tables.serverAllocations.id, allocationId))
    .run()

  await recordAuditEventFromRequest(event, {
    actor: session?.user?.email || session?.user?.id || 'unknown',
    actorType: 'user',
    action: 'server.allocation.updated',
    targetType: 'server',
    targetId: server.id,
    metadata: {
      allocationId,
    },
  })

  const updated = db
    .select()
    .from(tables.serverAllocations)
    .where(eq(tables.serverAllocations.id, allocationId))
    .get()

  await invalidateServerCaches({ id: server.id, uuid: server.uuid, identifier: server.identifier })

  return {
    data: {
      id: updated!.id,
      ip: updated!.ip,
      port: updated!.port,
      is_primary: updated!.isPrimary,
      notes: updated!.notes,
      assigned: true,
    },
  }
})
