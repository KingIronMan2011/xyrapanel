import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables } from '~~/server/utils/drizzle'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const db = useDrizzle()
  const nodes = await db
    .select({
      id: tables.wingsNodes.id,
      name: tables.wingsNodes.name,
    })
    .from(tables.wingsNodes)
    .orderBy(tables.wingsNodes.name)
    .all()

  return { data: nodes }
})
