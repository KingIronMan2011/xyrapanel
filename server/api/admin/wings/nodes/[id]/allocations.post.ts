import { defineEventHandler, readBody, createError } from 'h3'
import { eq, and } from 'drizzle-orm'
import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables } from '~~/server/utils/drizzle'
import { randomUUID } from 'node:crypto'
import { parseCidr, parsePorts, CidrOutOfRangeError, InvalidIpAddressError } from '~~/server/utils/ip-utils'

export default defineEventHandler(async (event) => {
  const { id: nodeId } = event.context.params ?? {}
  if (!nodeId || typeof nodeId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Missing node id' })
  }

  await requireAdmin(event)

  const db = useDrizzle()

  const node = db.select()
    .from(tables.wingsNodes)
    .where(eq(tables.wingsNodes.id, nodeId))
    .get()

  if (!node) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }

  const body = await readBody(event)

  let ipAddresses: string[]
  let ports: number[]

  if (body.ip && typeof body.ip === 'string') {
    try {
      ipAddresses = parseCidr(body.ip)
    } catch (error) {
      if (error instanceof CidrOutOfRangeError || error instanceof InvalidIpAddressError) {
        throw createError({ statusCode: 400, statusMessage: error.message })
      }
      throw error
    }
  } else if (Array.isArray(body.ip) && body.ip.length > 0) {
    ipAddresses = body.ip as string[]
    for (const ip of ipAddresses) {
      if (typeof ip !== 'string') {
        throw createError({ statusCode: 400, statusMessage: 'IP addresses must be strings' })
      }
    }
  } else {
    throw createError({ statusCode: 400, statusMessage: 'IP address or CIDR notation is required' })
  }

  if (body.ports) {
    try {
      ports = parsePorts(body.ports)
    } catch (error) {
      throw createError({
        statusCode: 400,
        statusMessage: error instanceof Error ? error.message : 'Invalid port format',
      })
    }
  } else {
    throw createError({ statusCode: 400, statusMessage: 'At least one port is required' })
  }

  const ipAlias = body.ipAlias as string | undefined

  const allocationsToCreate: Array<typeof tables.serverAllocations.$inferInsert> = []

  for (const ip of ipAddresses) {
    for (const port of ports) {
      const existing = db.select()
        .from(tables.serverAllocations)
        .where(and(
          eq(tables.serverAllocations.nodeId, nodeId),
          eq(tables.serverAllocations.ip, ip),
          eq(tables.serverAllocations.port, port),
        ))
        .get()

      if (existing) {
        continue
      }

      const timestamp = new Date()

      allocationsToCreate.push({
        id: randomUUID(),
        nodeId,
        ip,
        port,
        ipAlias: ipAlias || null,
        isPrimary: false,
        serverId: null,
        notes: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    }
  }

  if (allocationsToCreate.length === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'All specified allocations already exist'
    })
  }

  db.insert(tables.serverAllocations).values(allocationsToCreate).run()

  return {
    success: true,
    created: allocationsToCreate.length,
    allocations: allocationsToCreate.map(a => ({
      id: a.id,
      ip: a.ip,
      port: a.port,
      ipAlias: a.ipAlias,
    })),
  }
})
