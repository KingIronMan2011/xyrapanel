import { createError, getQuery, parseCookies } from 'h3'
import { auth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const query = getQuery(event)
  const includeCurrent = query.includeCurrent === 'true'

  if (includeCurrent) {
    await auth.api.revokeOtherSessions({
      headers: event.req.headers,
    })
    
    const cookies = parseCookies(event)
    const currentToken = cookies['better-auth.session_token']
    if (currentToken) {
      await auth.api.revokeSession({
        body: { token: currentToken },
        headers: event.req.headers,
      })
    }

    return {
      revoked: 1,
      currentSessionRevoked: true,
    }
  }

  await auth.api.revokeOtherSessions({
    headers: event.req.headers,
  })

  return {
    revoked: 1,
    currentSessionRevoked: false,
  }
})
