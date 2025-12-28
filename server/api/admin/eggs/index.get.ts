import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables } from '~~/server/utils/drizzle'
import { requireAdminApiKeyPermission } from '~~/server/utils/admin-api-permissions'
import { ADMIN_ACL_RESOURCES, ADMIN_ACL_PERMISSIONS } from '~~/server/utils/admin-acl'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  await requireAdminApiKeyPermission(event, ADMIN_ACL_RESOURCES.EGGS, ADMIN_ACL_PERMISSIONS.READ)

  const db = useDrizzle()

  const nests = await db.select({
    id: tables.nests.id,
    name: tables.nests.name,
  }).from(tables.nests).all()

  const eggs = await db.select({
    id: tables.eggs.id,
    name: tables.eggs.name,
    nestId: tables.eggs.nestId,
  }).from(tables.eggs).all()

  const nestNames = nests.reduce<Record<string, string>>((acc, nest) => {
    acc[nest.id] = nest.name || nest.id
    return acc
  }, {})

  const data = eggs.map(egg => ({
    id: egg.id,
    name: egg.name,
    nestName: nestNames[egg.nestId] ?? null,
  }))

  return { data }
})
