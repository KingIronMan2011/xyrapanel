import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const keyId = getRouterParam(event, 'id')

  if (!keyId) {
    throw createError({
      statusCode: 400,
      message: 'API key ID is required',
    })
  }

  const db = useDrizzle()

  const key = db
    .select()
    .from(tables.apiKeys)
    .where(eq(tables.apiKeys.id, keyId))
    .get()

  if (!key) {
    throw createError({
      statusCode: 404,
      message: 'API key not found',
    })
  }

  db.delete(tables.apiKeys)
    .where(eq(tables.apiKeys.id, keyId))
    .run()

  return { success: true }
})
