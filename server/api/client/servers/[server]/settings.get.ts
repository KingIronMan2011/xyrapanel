import { eq } from 'drizzle-orm'
import type { SettingsData } from '#shared/types/server'
import { getServerSession } from '~~/server/utils/session'
import { getServerWithAccess } from '~~/server/utils/server-helpers'
import { useDrizzle, tables } from '~~/server/utils/drizzle'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const serverIdentifier = getRouterParam(event, 'server')

  if (!serverIdentifier) {
    throw createError({
      statusCode: 400,
      message: 'Server identifier is required',
    })
  }

  const { server } = await getServerWithAccess(serverIdentifier, session)

  const db = useDrizzle()
  const limitsRow = await db
    .select({
      cpu: tables.serverLimits.cpu,
      memory: tables.serverLimits.memory,
      disk: tables.serverLimits.disk,
      swap: tables.serverLimits.swap,
      io: tables.serverLimits.io,
      threads: tables.serverLimits.threads,
      oomDisabled: tables.serverLimits.oomDisabled,
    })
    .from(tables.serverLimits)
    .where(eq(tables.serverLimits.serverId, server.id))
    .limit(1)
    .get()

  const response: SettingsData = {
    server: {
      id: server.id,
      uuid: server.uuid,
      identifier: server.identifier,
      name: server.name,
      description: server.description,
      suspended: Boolean(server.suspended),
    },
    limits: limitsRow
      ? {
          cpu: limitsRow.cpu,
          memory: limitsRow.memory,
          disk: limitsRow.disk,
          swap: limitsRow.swap,
          io: limitsRow.io,
          threads: limitsRow.threads ?? null,
          oomDisabled: limitsRow.oomDisabled ?? true,
        }
      : null,
  }

  return {
    data: response,
  }
})
