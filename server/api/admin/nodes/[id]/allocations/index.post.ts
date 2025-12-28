import { createError } from 'h3'
import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables, eq, and } from '~~/server/utils/drizzle'
import { requireAdminApiKeyPermission } from '~~/server/utils/admin-api-permissions'
import { ADMIN_ACL_RESOURCES, ADMIN_ACL_PERMISSIONS } from '~~/server/utils/admin-acl'
import { parseCidr, parsePorts, CidrOutOfRangeError, InvalidIpAddressError } from '~~/server/utils/ip-utils'
import { randomUUID } from 'node:crypto'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  
  await requireAdminApiKeyPermission(event, ADMIN_ACL_RESOURCES.ALLOCATIONS, ADMIN_ACL_PERMISSIONS.WRITE)

  const nodeId = getRouterParam(event, 'id')
  if (!nodeId) {
    throw createError({
      statusCode: 400,
      message: 'Node ID is required',
    })
  }

  const body = await readBody(event)
  const { ip, ports, ipAlias } = body

  if (!ip || typeof ip !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'IP address or CIDR notation is required',
    })
  }

  if (!ports) {
    throw createError({
      statusCode: 400,
      message: 'Ports are required (can be a range like 25565-25600 or comma-separated)',
    })
  }

  let ipAddresses: string[]
  try {
    ipAddresses = parseCidr(ip)
  } catch (error) {
    if (error instanceof CidrOutOfRangeError) {
      throw createError({
        statusCode: 400,
        message: error.message,
      })
    }
    if (error instanceof InvalidIpAddressError) {
      throw createError({
        statusCode: 400,
        message: error.message,
      })
    }
    throw error
  }

  let portNumbers: number[]
  try {
    portNumbers = parsePorts(ports)
  } catch (error) {
    throw createError({
      statusCode: 400,
      message: error instanceof Error ? error.message : 'Invalid port format',
    })
  }

  const db = useDrizzle()
  const now = new Date()
  const created: Array<{ id: string; ip: string; port: number }> = []
  const skipped: Array<{ ip: string; port: number }> = []

  for (const ipAddr of ipAddresses) {
    for (const port of portNumbers) {
      const existing = db.select()
        .from(tables.serverAllocations)
        .where(and(
          eq(tables.serverAllocations.nodeId, nodeId),
          eq(tables.serverAllocations.ip, ipAddr),
          eq(tables.serverAllocations.port, port),
        ))
        .get()

      if (existing) {
        skipped.push({ ip: ipAddr, port })
        continue
      }

      const id = randomUUID()
      try {
        db.insert(tables.serverAllocations)
          .values({
            id,
            nodeId,
            serverId: null,
            ip: ipAddr,
            port,
            ipAlias: ipAlias || null,
            notes: null,
            createdAt: now,
            updatedAt: now,
          })
          .run()

        created.push({ id, ip: ipAddr, port })
      } catch (error) {
        console.error(`Failed to create allocation ${ipAddr}:${port}`, error)
      }
    }
  }

  if (created.length === 0 && skipped.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'All specified allocations already exist',
    })
  }

  return {
    success: true,
    message: `Created ${created.length} allocation${created.length === 1 ? '' : 's'}${skipped.length > 0 ? `, skipped ${skipped.length} existing` : ''}`,
    data: {
      created,
      skipped: skipped.length > 0 ? skipped : undefined,
    },
  }
})
