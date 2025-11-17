export interface BackupRemoteUploadResponse {
  parts: string[]
  part_size: number
}

export interface RestoreStatusRequest {
  successful: boolean
}
