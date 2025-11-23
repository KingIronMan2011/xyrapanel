import { defineEventHandler, parseCookies, setCookie } from 'h3'
import { getServerSession } from '~~/server/utils/session'
import { eq } from 'drizzle-orm'

import { useDrizzle, tables } from '~~/server/utils/drizzle'
import { resolveSessionUser } from '~~/server/utils/auth/sessionUser'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const user = resolveSessionUser(session)

  const db = useDrizzle()
  const cookies = parseCookies(event)
  const sessionCookieName = 'better-auth.session_token'
  const token = cookies[sessionCookieName]

  let revoked = 0

  if (token) {
    const result = db.delete(tables.sessions)
      .where(eq(tables.sessions.sessionToken, token))
      .run()

    if (typeof result?.changes === 'number') {
      revoked += result.changes
    }

    setCookie(event, sessionCookieName, '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  }

  return {
    success: true,
    revoked,
    userId: user?.id ?? null,
  }
})
