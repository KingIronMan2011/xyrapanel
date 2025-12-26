import { getServerSession } from '~~/server/utils/session'
import { getServerWithAccess } from '~~/server/utils/server-helpers'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const serverId = getRouterParam(event, 'server')

  if (!serverId) {
    throw createError({
      statusCode: 400,
      message: 'Server identifier is required',
    })
  }

  const { server } = await getServerWithAccess(serverId, session)

  const db = useDrizzle()

  const egg = server.eggId
    ? db
        .select()
        .from(tables.eggs)
        .where(eq(tables.eggs.id, server.eggId))
        .get()
    : null

  const envVars = db
    .select()
    .from(tables.serverStartupEnv)
    .where(eq(tables.serverStartupEnv.serverId, server.id))
    .all()

  const serverEnvMap = new Map<string, string>()
  for (const envVar of envVars) {
    serverEnvMap.set(envVar.key, envVar.value || '')
  }

  const environment: Record<string, string> = {}

  if (egg?.id) {
    const eggVariables = db
      .select()
      .from(tables.eggVariables)
      .where(eq(tables.eggVariables.eggId, egg.id))
      .all()

    for (const eggVar of eggVariables) {
      const value = serverEnvMap.get(eggVar.envVariable) ?? eggVar.defaultValue ?? ''
      environment[eggVar.envVariable] = value
    }
  }

  for (const [key, value] of serverEnvMap.entries()) {
    if (!environment[key]) {
      environment[key] = value
    }
  }

  let dockerImages: Record<string, string> = {}
  if (egg?.dockerImages) {
    try {
      dockerImages = typeof egg.dockerImages === 'string'
        ? JSON.parse(egg.dockerImages)
        : egg.dockerImages
    } catch (error) {
      console.warn('[client/startup] Failed to parse egg dockerImages:', error)
    }
  }

  if (Object.keys(dockerImages).length === 0 && egg?.dockerImage) {
    dockerImages = { [egg.name || 'Default']: egg.dockerImage }
  }

  return {
    data: {
      startup: server.startup || egg?.startup || '',
      dockerImage: server.dockerImage || server.image || egg?.dockerImage || '',
      dockerImages,
      environment,
    },
  }
})
