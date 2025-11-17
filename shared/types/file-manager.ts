export interface FileManagerOptions {
  userId?: string
  skipAudit?: boolean
}

export interface FileOperation {
  type:
    | 'create'
    | 'edit'
    | 'delete'
    | 'rename'
    | 'copy'
    | 'move'
    | 'chmod'
    | 'compress'
    | 'decompress'
  path: string
  newPath?: string
  content?: string
  permissions?: string
  files?: string[]
}

export interface FileUploadResult {
  success: boolean
  uploadUrl?: string
  error?: string
}
