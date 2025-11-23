import { z } from 'zod'

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
  password: z.string().min(8),
  role: z.enum(['user', 'admin']).default('user'),
})

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(1).max(255).optional(),
  name: z.string().min(1).max(255).optional(),
  password: z.string().min(8).optional(),
  role: z.enum(['user', 'admin']).optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

