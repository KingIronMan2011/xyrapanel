import { createError, type H3Event, readValidatedBody, getValidatedQuery, getValidatedRouterParams } from 'h3'
import { getAuth } from '~~/server/utils/auth'
import type { z } from 'zod'

export const BODY_SIZE_LIMITS = {
  SMALL: 64 * 1024,
  MEDIUM: 512 * 1024,
  LARGE: 10 * 1024 * 1024,
  VERY_LARGE: 100 * 1024 * 1024,
} as const

async function assertBodySize(event: H3Event, limit: number): Promise<void> {
  const req = event.node.req
  const contentLength = req.headers['content-length']
  
  if (contentLength) {
    const size = Number.parseInt(contentLength, 10)
    if (!Number.isNaN(size) && size > limit) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Request Entity Too Large',
        message: `Request body size (${size} bytes) exceeds the limit of ${limit} bytes`,
      })
    }
  }
}

export async function requireAuth(event: H3Event) {
  const auth = getAuth()
  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required',
    })
  }

  return session
}

export async function requireAdmin(event: H3Event) {
  const session = await requireAuth(event)
  const userRole = (session.user as { role?: string }).role

  if (userRole !== 'admin') {
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Admin privileges required',
    })
  }

  return session
}

export async function readValidatedBodyWithLimit<T>(
  event: H3Event,
  validate: z.ZodSchema<T> | ((body: unknown) => T),
  limit: number = BODY_SIZE_LIMITS.MEDIUM,
) {
  await assertBodySize(event, limit)
  return await readValidatedBody(event, validate)
}

export async function getValidatedQuerySafe<T>(
  event: H3Event,
  validate: z.ZodSchema<T> | ((query: unknown) => T),
) {
  return await getValidatedQuery(event, validate)
}

export async function getValidatedRouterParamsSafe<T>(
  event: H3Event,
  validate: z.ZodSchema<T> | ((params: unknown) => T),
) {
  return await getValidatedRouterParams(event, validate)
}

export async function isApiKeyAuthenticated(event: H3Event): Promise<boolean> {
  const authHeader = event.req.headers.authorization
  const apiKeyHeader = event.req.headers['x-api-key']

  if (apiKeyHeader || (authHeader && authHeader.startsWith('Bearer '))) {
    const auth = getAuth()
    const session = await auth.api.getSession({
      headers: event.req.headers,
    })

    return !!session?.user?.id
  }

  return false
}

export async function requireApiKeyAuth(event: H3Event) {
  const isApiKey = await isApiKeyAuthenticated(event)
  
  if (!isApiKey) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'API key authentication required. Provide a valid API key via Authorization: Bearer <key> or x-api-key header.',
    })
  }

  return await requireAuth(event)
}

