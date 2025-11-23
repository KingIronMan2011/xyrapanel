import { createError } from 'h3'
import { auth } from '~~/server/utils/auth'
import { validateBody } from '~~/server/utils/validation'
import { createApiKeySchema } from '#shared/schema/account'
import type { ApiKeyResponse } from '#shared/types/api'

export default defineEventHandler(async (event): Promise<ApiKeyResponse> => {
  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'You must be logged in to create API keys',
    })
  }

  const body = await validateBody(event, createApiKeySchema)

  const result = await auth.api.createApiKey({
    body: {
      name: body.memo || 'API Key',
      metadata: {
        memo: body.memo || null,
        allowedIps: body.allowedIps || [],
      },
    },
    headers: event.req.headers,
  })

  return {
    data: {
      identifier: result.data?.id || result.data?.keyId || '',
      description: result.data?.name || body.memo || null,
      allowed_ips: result.data?.metadata?.allowedIps || body.allowedIps || [],
      last_used_at: result.data?.lastUsedAt || null,
      created_at: result.data?.createdAt || new Date().toISOString(),
    },
    meta: {
      secret_token: result.data?.key || result.data?.apiKey || '',
    },
  }
})
