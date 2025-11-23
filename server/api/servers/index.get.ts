import { createError } from 'h3'
import { z } from 'zod'
import { requireAuth, getValidatedQuerySafe } from '~~/server/utils/security'

import { listWingsNodes } from '~~/server/utils/wings/nodesStore'
import { remoteListServers } from '~~/server/utils/wings/registry'
import { toWingsHttpError } from '~~/server/utils/wings/http'

import type { ServerListEntry, ServersResponse } from '#shared/types/server'

const serversQuerySchema = z.object({
  scope: z.enum(['own', 'all']).optional().default('own'),
})

export default defineEventHandler(async (event): Promise<ServersResponse> => {
  const session = await requireAuth(event)
  const user = session.user

  const query = await getValidatedQuerySafe(event, serversQuerySchema)
  const scope = query.scope
  const includeAll = scope === 'all'

  if (includeAll) {
    const userRole = (user as { role?: string }).role
    if (userRole !== 'admin') {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Admin access required to view all servers' })
    }
  }

  const nodes = listWingsNodes()
  const records: ServerListEntry[] = []

  for (const node of nodes) {
    try {
      const servers = await remoteListServers(node.id)

      for (const server of servers) {
        const extended = server as unknown as Record<string, unknown>

        records.push({
          uuid: server.uuid,
          identifier: server.identifier,
          name: server.name,
          nodeId: node.id,
          nodeName: node.name,
          description: typeof extended.description === 'string' ? extended.description : null,
          limits: typeof extended.limits === 'object' && extended.limits !== null ? extended.limits as Record<string, unknown> : null,
          featureLimits: typeof extended.feature_limits === 'object' && extended.feature_limits !== null ? extended.feature_limits as Record<string, unknown> : null,
          status: 'unknown',
          ownership: includeAll ? 'shared' : 'mine',
          suspended: Boolean(extended.suspended),
          isTransferring: Boolean(extended.is_transferring),
        })
      }
    }
    catch (error) {
      throw toWingsHttpError(error, { operation: 'list Wings servers', nodeId: node.id })
    }
  }

  return {
    data: records,
    generatedAt: new Date().toISOString(),
  }
})
