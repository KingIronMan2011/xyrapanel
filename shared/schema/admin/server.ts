import { z } from 'zod'

const threadsSchema = z
  .union([
    z.string().trim().min(1).max(191),
    z.literal('').transform(() => null),
    z.null(),
  ])
  .transform(value => (value === '' ? null : value))
  .nullable()

export const serverBuildSchema = z.object({
  cpu: z
    .number({ invalid_type_error: 'CPU limit must be a number' })
    .min(0, 'CPU limit cannot be negative')
    .optional(),
  memory: z
    .number({ invalid_type_error: 'Memory limit must be a number' })
    .min(0, 'Memory limit cannot be negative')
    .optional(),
  swap: z
    .number({ invalid_type_error: 'Swap must be a number' })
    .min(-1, 'Swap must be -1 or greater')
    .optional(),
  disk: z
    .number({ invalid_type_error: 'Disk limit must be a number' })
    .min(0, 'Disk limit cannot be negative')
    .optional(),
  io: z
    .number({ invalid_type_error: 'Block I/O must be a number' })
    .min(10, 'Block I/O must be at least 10')
    .max(1000, 'Block I/O cannot exceed 1000')
    .optional(),
  threads: threadsSchema.optional(),
  oomDisabled: z.boolean().optional(),
  databaseLimit: z.number().int().min(0).optional(),
  allocationLimit: z.number().int().min(0).optional(),
  backupLimit: z.number().int().min(0).optional(),
})

export const serverBuildFormSchema = serverBuildSchema.required({
  cpu: true,
  memory: true,
  swap: true,
  disk: true,
  io: true,
})

export type ServerBuildInput = z.infer<typeof serverBuildSchema>

export const serverStartupSchema = z.object({
  startup: z
    .string()
    .trim()
    .min(1, 'Startup command is required')
    .max(2048, 'Startup command is too long'),
  dockerImage: z
    .string()
    .trim()
    .min(1, 'Docker image is required')
    .max(255, 'Docker image is too long'),
  environment: z.record(z.string()),
})

export type ServerStartupInput = z.infer<typeof serverStartupSchema>

export const serverDatabaseCreateSchema = z.object({
  database: z
    .string()
    .trim()
    .min(1, 'Database name is required')
    .max(100, 'Database name must be under 100 characters'),
  remote: z
    .string()
    .trim()
    .min(1, 'Remote host is required')
    .max(255, 'Remote value is too long'),
})

export type ServerDatabaseCreateInput = z.infer<typeof serverDatabaseCreateSchema>

export const createServerSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  userId: z.string().uuid(),
  eggId: z.string().uuid(),
  nodeId: z.string().uuid(),
  allocationId: z.string().uuid(),
  memory: z.number().int().positive(),
  swap: z.number().int().min(0).default(0),
  disk: z.number().int().positive(),
  io: z.number().int().min(10).max(1000).default(500),
  cpu: z.number().int().min(0).default(0),
  threads: z.string().optional(),
  databases: z.number().int().min(0).default(0),
  allocations: z.number().int().min(0).default(0),
  backups: z.number().int().min(0).default(0),
  startup: z.string().optional(),
  environment: z.record(z.string()).optional(),
  skipScripts: z.boolean().default(false),
  startOnCompletion: z.boolean().default(true),
})

export const updateServerBuildSchema = z.object({
  memory: z.number().int().positive().optional(),
  swap: z.number().int().min(0).optional(),
  disk: z.number().int().positive().optional(),
  io: z.number().int().min(10).max(1000).optional(),
  cpu: z.number().int().min(0).optional(),
  threads: z.string().optional(),
  allocationId: z.string().uuid().optional(),
  addAllocations: z.array(z.string().uuid()).optional(),
  removeAllocations: z.array(z.string().uuid()).optional(),
})

export const updateServerStartupSchema = z.object({
  startup: z.string().optional(),
  environment: z.record(z.string()).optional(),
  eggId: z.string().uuid().optional(),
  dockerImage: z.string().optional(),
  skipScripts: z.boolean().optional(),
})

export const updateServerDetailsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  userId: z.string().uuid().optional(),
})

export const createServerDatabaseSchema = z.object({
  database: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_]+$/),
  remote: z.string().default('%'),
})

const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/

const ipValidator = z.string().regex(ipRegex, 'Invalid IP address format')

export const createAdminApiKeySchema = z.object({
  memo: z.string().min(1).max(500),
  allowedIps: z.array(ipValidator).optional(),
  expiresAt: z.string().datetime().optional(),
})

export type CreateServerInput = z.infer<typeof createServerSchema>
export type UpdateServerBuildInput = z.infer<typeof updateServerBuildSchema>
export type UpdateServerStartupInput = z.infer<typeof updateServerStartupSchema>
export type UpdateServerDetailsInput = z.infer<typeof updateServerDetailsSchema>
export type CreateAdminApiKeyInput = z.infer<typeof createAdminApiKeySchema>
