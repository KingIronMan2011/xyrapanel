import { assertMethod, createError, getValidatedRouterParams } from 'h3'
import { auth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  assertMethod(event, 'DELETE')

  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const { identifier } = await getValidatedRouterParams(event, (params) => {
    const identifierParam = (params as Record<string, unknown>).identifier
    if (typeof identifierParam !== 'string' || identifierParam.trim().length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Missing API key identifier' })
    }

    return { identifier: identifierParam }
  })

  await auth.api.deleteApiKey({
    body: {
      keyId: identifier,
    },
    headers: event.req.headers,
  })

  return { success: true }
})
