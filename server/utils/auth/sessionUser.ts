import type { ResolvedSessionUser } from '#shared/types/auth'
import type { getServerSession} from '~~/server/utils/session';
import { getSessionUser } from '~~/server/utils/session'

export function resolveSessionUser(
  session: Awaited<ReturnType<typeof getServerSession>> | null
): ResolvedSessionUser | null {
  const user = getSessionUser(session)
  
  if (!user || !user.id || !user.username || !user.role) {
    return null
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions ?? [],
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
    remember: user.remember ?? null,
    passwordResetRequired: user.passwordResetRequired ?? false,
  }
}

