import { createError } from 'h3'
import { auth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const apiKeys = await auth.api.listApiKeys({
    headers: event.req.headers,
  })

  interface ApiKeyItem {
    id?: string
    keyId?: string
    name?: string
    metadata?: { memo?: string; allowedIps?: string[] }
    lastUsedAt?: Date | string | null
    createdAt?: Date | string
  }
  
  return {
    data: (apiKeys.data || []).map((key: ApiKeyItem) => ({
      identifier: key.id || key.keyId,
      description: key.name || key.metadata?.memo || null,
      allowed_ips: key.metadata?.allowedIps || [],
      last_used_at: key.lastUsedAt || null,
      created_at: key.createdAt || new Date().toISOString(),
    })),
  }
})
