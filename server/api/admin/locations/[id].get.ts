import { eq } from 'drizzle-orm'
import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables } from '~~/server/utils/drizzle'
import { requireAdminApiKeyPermission } from '~~/server/utils/admin-api-permissions'
import { ADMIN_ACL_RESOURCES, ADMIN_ACL_PERMISSIONS } from '~~/server/utils/admin-acl'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  await requireAdminApiKeyPermission(event, ADMIN_ACL_RESOURCES.LOCATIONS, ADMIN_ACL_PERMISSIONS.READ)

  const locationId = getRouterParam(event, 'id')
  if (!locationId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Location ID is required' })
  }

  const db = useDrizzle()

  const location = await db
    .select()
    .from(tables.locations)
    .where(eq(tables.locations.id, locationId))
    .get()

  if (!location) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Location not found' })
  }

  return {
    data: {
      id: location.id,
      short: location.short,
      long: location.long,
      createdAt: new Date(location.createdAt).toISOString(),
      updatedAt: new Date(location.updatedAt).toISOString(),
    },
  }
})
