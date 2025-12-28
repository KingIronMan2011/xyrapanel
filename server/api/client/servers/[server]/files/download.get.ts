import { getServerSession } from '~~/server/utils/session'
import { getServerWithAccess } from '~~/server/utils/server-helpers'
import { getWingsClientForServer } from '~~/server/utils/wings-client'
import { requireServerPermission } from '~~/server/utils/permission-middleware'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const serverId = getRouterParam(event, 'server')
  const query = getQuery(event)
  const file = query.file as string

  if (!serverId) {
    throw createError({
      statusCode: 400,
      message: 'Server identifier is required',
    })
  }

  if (!file) {
    throw createError({
      statusCode: 400,
      message: 'File path is required',
    })
  }

  const { server } = await getServerWithAccess(serverId, session)

  await requireServerPermission(event, {
    serverId: server.id,
    requiredPermissions: ['server.files.download'],
  })

  try {
    const { client } = await getWingsClientForServer(server.uuid)
    const downloadUrl = client.getFileDownloadUrl(server.uuid, file)

    return {
      attributes: {
        url: downloadUrl,
      },
    }
  } catch (error) {
    console.error('Failed to get download URL from Wings:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to get download URL',
    })
  }
})
