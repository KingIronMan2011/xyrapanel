import { getServerSession } from '~~/server/utils/session'
import { parseCookies, getRequestIP, getHeader } from 'h3'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { resolveSessionUser } from '~~/server/utils/auth/sessionUser'
import { parseUserAgent } from '~~/server/utils/user-agent'

type AuthContext = {
  session: Awaited<ReturnType<typeof getServerSession>>
  user: NonNullable<ReturnType<typeof resolveSessionUser>>
}

export default defineEventHandler(async (event) => {
  const path = event.path || event.node.req.url || ''
  if (path.startsWith('/api/auth'))
    return

  const contextAuth = (event.context as { auth?: AuthContext }).auth
  const session = contextAuth?.session ?? await getServerSession(event)
  const resolvedUser = contextAuth?.user ?? resolveSessionUser(session)

  if (!resolvedUser?.id) {
    return
  }

  const cookies = parseCookies(event)
  const token = cookies['better-auth.session_token']

  if (!token) {
    return
  }

  const db = useDrizzle()
  const userAgent = getHeader(event, 'user-agent') || ''
  const ipAddress = getRequestIP(event) || 'Unknown'
  const now = new Date()
  const deviceInfo = parseUserAgent(userAgent)

  const hasSession = db
    .select({ token: tables.sessions.sessionToken })
    .from(tables.sessions)
    .where(eq(tables.sessions.sessionToken, token))
    .get()

  if (!hasSession) {
    return
  }

  await db.insert(tables.sessionMetadata).values({
    sessionToken: token,
    firstSeenAt: now,
    lastSeenAt: now,
    ipAddress,
    userAgent,
    deviceName: deviceInfo.device,
    browserName: deviceInfo.browser,
    osName: deviceInfo.os,
  }).onConflictDoUpdate({
    target: tables.sessionMetadata.sessionToken,
    set: {
      lastSeenAt: now,
      ipAddress,
      userAgent,
      deviceName: deviceInfo.device,
      browserName: deviceInfo.browser,
      osName: deviceInfo.os,
    },
  })
})
