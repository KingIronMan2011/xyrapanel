import type { SessionUser } from './auth'
import type { StoredWingsNode } from './wings'

export interface ServerRequestContext<TServer = unknown> {
  user: SessionUser
  server: TServer
  permissions: string[]
  isAdmin: boolean
  isOwner: boolean
  subuserPermissions: string[] | null
  node: StoredWingsNode | null
  nodeConnection: {
    tokenId: string
    tokenSecret: string
    combinedToken: string
  } | null
}

export interface ServerAccessOptions {
  identifier?: string
  requireNode?: boolean
  requiredPermissions?: string[]
  fallbackPermissions?: string[]
}
