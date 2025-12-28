import { createError } from 'h3'
import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { requireAdminApiKeyPermission } from '~~/server/utils/admin-api-permissions'
import { ADMIN_ACL_RESOURCES, ADMIN_ACL_PERMISSIONS } from '~~/server/utils/admin-acl'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  
  await requireAdminApiKeyPermission(event, ADMIN_ACL_RESOURCES.ALLOCATIONS, ADMIN_ACL_PERMISSIONS.READ)

  const nodeId = getRouterParam(event, 'id')
  if (!nodeId) {
    throw createError({
      statusCode: 400,
      message: 'Node ID is required',
    })
  }

  const db = useDrizzle()
  const allocations = db.select()
    .from(tables.serverAllocations)
    .where(eq(tables.serverAllocations.nodeId, nodeId))
    .all()

  return {
    data: allocations,
  }
})
