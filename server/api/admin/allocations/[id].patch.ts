import { createError } from 'h3'
import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { requireAdminApiKeyPermission } from '~~/server/utils/admin-api-permissions'
import { ADMIN_ACL_RESOURCES, ADMIN_ACL_PERMISSIONS } from '~~/server/utils/admin-acl'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  
  await requireAdminApiKeyPermission(event, ADMIN_ACL_RESOURCES.ALLOCATIONS, ADMIN_ACL_PERMISSIONS.WRITE)

  const allocationId = getRouterParam(event, 'id')
  if (!allocationId) {
    throw createError({
      statusCode: 400,
      message: 'Allocation ID is required',
    })
  }

  const body = await readBody(event)
  const { ipAlias } = body

  const db = useDrizzle()
  const [allocation] = db.select()
    .from(tables.serverAllocations)
    .where(eq(tables.serverAllocations.id, allocationId))
    .limit(1)
    .all()

  if (!allocation) {
    throw createError({
      statusCode: 404,
      message: 'Allocation not found',
    })
  }

  db.update(tables.serverAllocations)
    .set({
      ipAlias: ipAlias || null,
      updatedAt: new Date(),
    })
    .where(eq(tables.serverAllocations.id, allocationId))
    .run()

  return {
    success: true,
    message: 'Allocation updated successfully',
  }
})
