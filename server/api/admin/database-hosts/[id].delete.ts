import { eq } from 'drizzle-orm'
import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables } from '~~/server/utils/drizzle'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const hostId = getRouterParam(event, 'id')
  if (!hostId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Host ID is required' })
  }

  const db = useDrizzle()

  const existing = await db
    .select()
    .from(tables.databaseHosts)
    .where(eq(tables.databaseHosts.id, hostId))
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Database host not found' })
  }

  const databasesCount = await db
    .select()
    .from(tables.serverDatabases)
    .where(eq(tables.serverDatabases.databaseHostId, hostId))
    .all()

  if (databasesCount.length > 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `Cannot delete host with ${databasesCount.length} database(s)`,
    })
  }

  await db.delete(tables.databaseHosts).where(eq(tables.databaseHosts.id, hostId))

  return { success: true }
})
