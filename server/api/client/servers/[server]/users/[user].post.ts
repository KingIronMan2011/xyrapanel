import { getServerSession } from '~~/server/utils/session'
import { getServerWithAccess } from '~~/server/utils/server-helpers'
import { useDrizzle, tables, eq, and } from '~~/server/utils/drizzle'
import { invalidateServerSubusersCache } from '~~/server/utils/subusers'
import { requireServerPermission } from '~~/server/utils/permission-middleware'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'

interface UpdateSubuserPayload {
  permissions: string[]
}

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const serverId = getRouterParam(event, 'server')
  const subuserId = getRouterParam(event, 'user')

  if (!serverId || !subuserId) {
    throw createError({
      statusCode: 400,
      message: 'Server and user identifiers are required',
    })
  }

  const { server } = await getServerWithAccess(serverId, session)

  await requireServerPermission(event, {
    serverId: server.id,
    requiredPermissions: ['server.users.update'],
  })

  const body = await readBody<UpdateSubuserPayload>(event)

  const db = useDrizzle()
  const subuser = db
    .select()
    .from(tables.serverSubusers)
    .where(
      and(
        eq(tables.serverSubusers.id, subuserId),
        eq(tables.serverSubusers.serverId, server.id)
      )
    )
    .get()

  if (!subuser) {
    throw createError({
      statusCode: 404,
      message: 'Subuser not found',
    })
  }

  const now = new Date()
  db.update(tables.serverSubusers)
    .set({
      permissions: JSON.stringify(body.permissions),
      updatedAt: now,
    })
    .where(eq(tables.serverSubusers.id, subuserId))
    .run()

  await recordAuditEventFromRequest(event, {
    actor: session?.user?.email || session?.user?.id || 'unknown',
    actorType: 'user',
    action: 'server.user.updated',
    targetType: 'user',
    targetId: subuser.userId,
    metadata: {
      serverId: server.id,
      subuserId,
      permissions: body.permissions,
    },
  })

  const result = db
    .select({
      subuser: tables.serverSubusers,
      user: tables.users,
    })
    .from(tables.serverSubusers)
    .leftJoin(tables.users, eq(tables.serverSubusers.userId, tables.users.id))
    .where(eq(tables.serverSubusers.id, subuserId))
    .get()

  await invalidateServerSubusersCache(server.id, [subuser.userId])

  return {
    data: {
      id: result!.subuser.id,
      user: {
        id: result!.user!.id,
        username: result!.user!.username,
        email: result!.user!.email,
        image: result!.user!.image,
      },
      permissions: JSON.parse(result!.subuser.permissions),
      created_at: result!.subuser.createdAt,
      updated_at: result!.subuser.updatedAt,
    },
  }
})
