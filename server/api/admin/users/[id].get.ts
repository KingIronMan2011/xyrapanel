import { createError } from 'h3'
import { getAuth } from '~~/server/utils/auth'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const auth = getAuth()
  
  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Admin access required',
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      message: 'User ID is required',
    })
  }

  const db = useDrizzle()

  const user = db
    .select({
      id: tables.users.id,
      username: tables.users.username,
      email: tables.users.email,
      nameFirst: tables.users.nameFirst,
      nameLast: tables.users.nameLast,
      language: tables.users.language,
      rootAdmin: tables.users.rootAdmin,
      role: tables.users.role,
      useTotp: tables.users.useTotp,
      totpAuthenticatedAt: tables.users.totpAuthenticatedAt,
      emailVerified: tables.users.emailVerified,
      suspended: tables.users.suspended,
      suspendedAt: tables.users.suspendedAt,
      suspensionReason: tables.users.suspensionReason,
      passwordResetRequired: tables.users.passwordResetRequired,
      createdAt: tables.users.createdAt,
      updatedAt: tables.users.updatedAt,
    })
    .from(tables.users)
    .where(eq(tables.users.id, id))
    .get()

  if (!user) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  const servers = db
    .select({
      id: tables.servers.id,
      uuid: tables.servers.uuid,
      identifier: tables.servers.identifier,
      name: tables.servers.name,
      status: tables.servers.status,
      suspended: tables.servers.suspended,
      createdAt: tables.servers.createdAt,
      nodeName: tables.wingsNodes.name,
    })
    .from(tables.servers)
    .leftJoin(tables.wingsNodes, eq(tables.servers.nodeId, tables.wingsNodes.id))
    .where(eq(tables.servers.ownerId, user.id))
    .orderBy(desc(tables.servers.createdAt))
    .all()

  const apiKeys = db
    .select({
      id: tables.apiKeys.id,
      identifier: tables.apiKeys.identifier,
      memo: tables.apiKeys.memo,
      createdAt: tables.apiKeys.createdAt,
      lastUsedAt: tables.apiKeys.lastUsedAt,
      expiresAt: tables.apiKeys.expiresAt,
    })
    .from(tables.apiKeys)
    .where(eq(tables.apiKeys.userId, user.id))
    .orderBy(desc(tables.apiKeys.createdAt))
    .all()

  const activity = db
    .select({
      id: tables.auditEvents.id,
      occurredAt: tables.auditEvents.occurredAt,
      action: tables.auditEvents.action,
      targetType: tables.auditEvents.targetType,
      targetId: tables.auditEvents.targetId,
      actor: tables.auditEvents.actor,
      metadata: tables.auditEvents.metadata,
    })
    .from(tables.auditEvents)
    .where(eq(tables.auditEvents.actor, user.username))
    .orderBy(desc(tables.auditEvents.occurredAt))
    .limit(10)
    .all()

  const formatTimestamp = (value: number | Date | null | undefined) => {
    if (!value) {
      return null
    }

    const date = value instanceof Date ? value : new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const parseMetadata = (value: string | null) => {
    if (!value) {
      return {}
    }

    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>
      }
      return { value: parsed }
    }
    catch {
      return { raw: value }
    }
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.nameFirst ?? null,
      lastName: user.nameLast ?? null,
      name: user.nameFirst || user.nameLast ? `${user.nameFirst ?? ''} ${user.nameLast ?? ''}`.trim() || null : null,
      language: user.language,
      role: user.role,
      rootAdmin: Boolean(user.rootAdmin),
      twoFactorEnabled: Boolean(user.useTotp),
      emailVerified: Boolean(user.emailVerified),
      emailVerifiedAt: formatTimestamp(user.emailVerified),
      suspended: Boolean(user.suspended),
      suspendedAt: formatTimestamp(user.suspendedAt),
      suspensionReason: user.suspensionReason ?? null,
      passwordResetRequired: Boolean(user.passwordResetRequired),
      createdAt: formatTimestamp(user.createdAt)!,
      updatedAt: formatTimestamp(user.updatedAt)!,
    },
    stats: {
      serverCount: servers.length,
      apiKeyCount: apiKeys.length,
    },
    servers: servers.map(server => ({
      id: server.id,
      uuid: server.uuid,
      identifier: server.identifier,
      name: server.name,
      status: server.status,
      suspended: Boolean(server.suspended),
      nodeName: server.nodeName ?? null,
      createdAt: formatTimestamp(server.createdAt)!,
    })),
    apiKeys: apiKeys.map(key => ({
      id: key.id,
      identifier: key.identifier,
      memo: key.memo,
      createdAt: formatTimestamp(key.createdAt)!,
      lastUsedAt: formatTimestamp(key.lastUsedAt),
      expiresAt: formatTimestamp(key.expiresAt),
    })),
    activity: activity.map(entry => ({
      id: entry.id,
      occurredAt: formatTimestamp(entry.occurredAt)!,
      action: entry.action,
      target: entry.targetId ? `${entry.targetType}#${entry.targetId}` : entry.targetType,
      actor: entry.actor,
      details: parseMetadata(entry.metadata ?? null),
    })),
  }
})
