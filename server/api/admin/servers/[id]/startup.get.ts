import { createError } from 'h3'
import { requireAdmin } from '~~/server/utils/security'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { requireAdminApiKeyPermission } from '~~/server/utils/admin-api-permissions'
import { ADMIN_ACL_RESOURCES, ADMIN_ACL_PERMISSIONS } from '~~/server/utils/admin-acl'

export default defineEventHandler(async (event) => {
  try {
    await requireAdmin(event)
    
    await requireAdminApiKeyPermission(event, ADMIN_ACL_RESOURCES.SERVERS, ADMIN_ACL_PERMISSIONS.READ)

    const identifier = getRouterParam(event, 'id')
    if (!identifier) {
      throw createError({
        statusCode: 400,
        message: 'Server ID is required',
      })
    }

    console.log('[Startup GET] Request received:', { identifier, path: event.path })

    const db = useDrizzle()
    
    const { findServerByIdentifier } = await import('~~/server/utils/serversStore')
    const server = await findServerByIdentifier(identifier)

    if (!server) {
      console.error('[Startup GET] Server not found:', identifier)
      throw createError({
        statusCode: 404,
        message: 'Server not found',
      })
    }

    const serverId = server.id
    console.log('[Startup GET] Server found:', { serverId, uuid: server.uuid, eggId: server.eggId })

  const envVars = db.select()
    .from(tables.serverStartupEnv)
    .where(eq(tables.serverStartupEnv.serverId, serverId))
    .all()

  const serverEnvMap = new Map<string, string>()
  for (const envVar of envVars) {
    serverEnvMap.set(envVar.key, envVar.value || '')
  }

  const egg = server.eggId
    ? db
        .select()
        .from(tables.eggs)
        .where(eq(tables.eggs.id, server.eggId))
        .get()
    : null

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

  const eggVariablesCount = egg?.id 
    ? db.select().from(tables.eggVariables).where(eq(tables.eggVariables.eggId, egg.id)).all().length 
    : 0

  console.log('[Startup GET] Returning environment variables:', {
    identifier,
    serverId,
    serverUuid: server.uuid,
    eggId: egg?.id,
    eggName: egg?.name,
    eggVariablesCount,
    serverEnvCount: envVars.length,
    finalEnvCount: Object.keys(environment).length,
    environmentKeys: Object.keys(environment),
    environment,
  })

    let dockerImages: Record<string, string> = {}
    if (egg?.dockerImages) {
      try {
        dockerImages = typeof egg.dockerImages === 'string' 
          ? JSON.parse(egg.dockerImages) 
          : egg.dockerImages
      } catch (e) {
        console.warn('[Startup GET] Failed to parse egg dockerImages:', e)
      }
    }
    
    if (Object.keys(dockerImages).length === 0 && egg?.dockerImage) {
      dockerImages = { [egg.name || 'Default']: egg.dockerImage }
    }

    console.log('[Startup GET] Docker images from egg:', {
      dockerImages,
      dockerImageCount: Object.keys(dockerImages).length,
      currentDockerImage: server.dockerImage || server.image || egg?.dockerImage || '',
    })

    return {
      data: {
        startup: server.startup || egg?.startup || '',
        dockerImage: server.dockerImage || server.image || egg?.dockerImage || '',
        dockerImages, 
        environment,
      },
    }
  } catch (error) {
    console.error('[Startup GET] Error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      message: 'Failed to load startup configuration',
      cause: error,
    })
  }
})
