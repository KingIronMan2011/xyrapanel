import { eq } from 'drizzle-orm'
import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables } from '~~/server/utils/drizzle'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const mountId = getRouterParam(event, 'id')
  if (!mountId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'Mount ID is required' })
  }

  const db = useDrizzle()

  const existing = await db
    .select()
    .from(tables.mounts)
    .where(eq(tables.mounts.id, mountId))
    .get()

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Mount not found' })
  }

  await db.delete(tables.mounts).where(eq(tables.mounts.id, mountId))

  return { success: true }
})
