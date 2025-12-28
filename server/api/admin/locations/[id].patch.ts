import { eq } from 'drizzle-orm'
import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables } from '~~/server/utils/drizzle'
import { requireAdminApiKeyPermission } from '~~/server/utils/admin-api-permissions'
import { ADMIN_ACL_RESOURCES, ADMIN_ACL_PERMISSIONS } from '~~/server/utils/admin-acl'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'
import type { UpdateLocationPayload } from '#shared/types/admin'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)

  await requireAdminApiKeyPermission(event, ADMIN_ACL_RESOURCES.LOCATIONS, ADMIN_ACL_PERMISSIONS.WRITE)

  const locationId = getRouterParam(event, 'id')
  if (!locationId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Location ID is required' })
  }

  const body = await readBody<UpdateLocationPayload>(event)
  const db = useDrizzle()

  const existing = await db
    .select()
    .from(tables.locations)
    .where(eq(tables.locations.id, locationId))
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Location not found' })
  }

  const updates: Partial<typeof tables.locations.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (body.short !== undefined) updates.short = body.short
  if (body.long !== undefined) updates.long = body.long

  await db
    .update(tables.locations)
    .set(updates)
    .where(eq(tables.locations.id, locationId))

  const updated = await db
    .select()
    .from(tables.locations)
    .where(eq(tables.locations.id, locationId))
    .get()

  await recordAuditEventFromRequest(event, {
    actor: session.user.email || session.user.id,
    actorType: 'user',
    action: 'admin.location.updated',
    targetType: 'settings',
    targetId: locationId,
    metadata: {
      fields: Object.keys(body),
    },
  })

  return {
    data: {
      id: updated!.id,
      short: updated!.short,
      long: updated!.long,
      createdAt: new Date(updated!.createdAt).toISOString(),
      updatedAt: new Date(updated!.updatedAt).toISOString(),
    },
  }
})
