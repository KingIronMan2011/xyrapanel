import { createError } from 'h3'
import { auth } from '~~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return {
    data: {
      id: session.user.id,
      username: session.user.username || null,
      email: session.user.email || null,
      role: (session.user as { role?: string }).role || 'user',
    },
  }
})
