import { getServerSession } from '~~/server/utils/session'
import { getServerWithAccess } from '~~/server/utils/server-helpers'
import { getWingsClientForServer } from '~~/server/utils/wings-client'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { requireServerPermission } from '~~/server/utils/permission-middleware'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const serverId = getRouterParam(event, 'server')
  const backupUuid = getRouterParam(event, 'backup')

  if (!serverId || !backupUuid) {
    throw createError({
      statusCode: 400,
      message: 'Server and backup identifiers are required',
    })
  }

  const body = (await readBody<{ truncate?: boolean }>(event)) ?? {}
  const { truncate = false } = body

  const { server } = await getServerWithAccess(serverId, session)

  await requireServerPermission(event, {
    serverId: server.id,
    requiredPermissions: ['server.backup.restore'],
  })

  const db = useDrizzle()
  const backup = db.select()
    .from(tables.serverBackups)
    .where(eq(tables.serverBackups.uuid, backupUuid))
    .limit(1)
    .all()
    .at(0)

  if (!backup || backup.serverId !== server.id) {
    throw createError({
      statusCode: 404,
      message: 'Backup not found',
    })
  }

  try {
    const { client } = await getWingsClientForServer(serverId)
    await client.restoreBackup(server.uuid, backup.uuid, truncate)

    await recordAuditEventFromRequest(event, {
      actor: session?.user?.email || session?.user?.id || 'unknown',
      actorType: 'user',
      action: 'server.backup.restored',
      targetType: 'backup',
      targetId: backupUuid,
      metadata: {
        serverId: server.id,
        backupName: backup?.name,
        truncate,
      },
    })

    return {
      success: true,
      message: 'Backup restore initiated',
    }
  } catch (error) {
    console.error('Failed to restore backup on Wings:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to restore backup',
    })
  }
})
