export const ADMIN_PERMISSIONS = [
  'control.console',
  'control.start',
  'control.stop',
  'control.restart',
  'websocket.connect',
  'admin.websocket.errors',
  'admin.websocket.install',
  'admin.websocket.transfer',
  'file.read',
  'file.write',
  'file.delete',
  'file.rename',
  'file.download',
  'file.upload',
  'file.copy',
  'file.create',
  'file.chmod',
  'file.compress',
  'file.decompress',
  'file.pull',
]

export const DEFAULT_SUBUSER_PERMISSIONS = [
  'control.console',
  'control.start',
  'control.stop',
  'control.restart',
  'websocket.connect',
  'file.read',
  'file.write',
  'file.download',
  'file.upload',
  'file.copy',
]

export interface GetUserPermissionsOptions {
  isAdmin?: boolean
  isOwner?: boolean
  subuserPermissions?: string[] | null
}

export type Permission =
  | 'server.view'
  | 'server.console'
  | 'server.power'
  | 'server.command'
  | 'server.files.read'
  | 'server.files.write'
  | 'server.files.delete'
  | 'server.files.upload'
  | 'server.files.download'
  | 'server.files.compress'
  | 'server.backup.create'
  | 'server.backup.restore'
  | 'server.backup.delete'
  | 'server.backup.download'
  | 'server.database.create'
  | 'server.database.read'
  | 'server.database.update'
  | 'server.database.delete'
  | 'server.schedule.create'
  | 'server.schedule.read'
  | 'server.schedule.update'
  | 'server.schedule.delete'
  | 'server.settings.read'
  | 'server.settings.update'
  | 'server.users.read'
  | 'server.users.create'
  | 'server.users.update'
  | 'server.users.delete'
  | 'server.files.*'
  | 'server.backup.*'
  | 'server.database.*'
  | 'server.schedule.*'
  | 'server.users.*'
  | 'control.console'
  | 'control.start'
  | 'control.stop'
  | 'control.restart'
  | 'control.power'
  | 'user.create'
  | 'user.read'
  | 'user.update'
  | 'user.delete'
  | 'file.create'
  | 'file.read'
  | 'file.update'
  | 'file.delete'
  | 'file.archive'
  | 'file.sftp'
  | 'backup.create'
  | 'backup.read'
  | 'backup.delete'
  | 'backup.download'
  | 'backup.restore'
  | 'allocation.read'
  | 'allocation.create'
  | 'allocation.update'
  | 'allocation.delete'
  | 'startup.read'
  | 'startup.update'
  | 'database.create'
  | 'database.read'
  | 'database.update'
  | 'database.delete'
  | 'database.view_password'
  | 'schedule.create'
  | 'schedule.read'
  | 'schedule.update'
  | 'schedule.delete'
  | 'settings.rename'
  | 'settings.reinstall'
  | 'admin.*'
  | 'admin.servers.*'
  | 'admin.users.*'
  | 'admin.nodes.*'
  | 'admin.locations.*'
  | 'admin.nests.*'
  | 'admin.eggs.*'
  | 'admin.mounts.*'
  | 'admin.settings.*'

export interface PermissionCheck {
  hasPermission: boolean
  reason?: string
}

export interface UserPermissions {
  userId: string
  isAdmin: boolean
  serverPermissions: Map<string, Permission[]>
}

export interface PermissionMiddlewareOptions {
  requiredPermissions: Permission[]
  serverId?: string
  allowOwner?: boolean
  allowAdmin?: boolean
}

export interface PermissionContext {
  userId: string
  isAdmin: boolean
  isOwner: boolean
  hasPermissions: boolean
  missingPermissions: Permission[]
}
