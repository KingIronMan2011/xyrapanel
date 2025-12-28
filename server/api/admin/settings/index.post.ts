import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<Record<string, string>>(event)
  const db = useDrizzle()

  for (const [key, value] of Object.entries(body)) {

    const existing = await db
      .select()
      .from(tables.settings)
      .where(eq(tables.settings.key, key))
      .get()

    if (existing) {

      await db
        .update(tables.settings)
        .set({ value })
        .where(eq(tables.settings.key, key))
        .run()
    } else {

      await db
        .insert(tables.settings)
        .values({ key, value })
        .run()
    }
  }

  return {
    success: true,
    message: 'Settings updated successfully',
  }
})
