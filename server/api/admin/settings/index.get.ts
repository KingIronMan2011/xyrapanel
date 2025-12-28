import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables } from '~~/server/utils/drizzle'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useDrizzle()
  const settings = await db.select().from(tables.settings).all()

  const settingsObject: Record<string, string> = {}
  for (const setting of settings) {
    settingsObject[setting.key] = setting.value
  }

  return {
    data: settingsObject,
  }
})
