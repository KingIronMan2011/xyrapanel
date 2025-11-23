import { createError } from 'h3'
import { APIError } from 'better-auth/api'
import { z } from 'zod'
import { getAuth } from '~~/server/utils/auth'
import { requireAdmin, readValidatedBodyWithLimit, BODY_SIZE_LIMITS } from '~~/server/utils/security'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'
import { randomUUID } from 'node:crypto'

const createUserSchema = z.object({
  username: z.string().min(1).max(255).optional(),
  email: z.string().email().min(1).max(255),
  password: z.string().min(12).max(255).optional(),
  nameFirst: z.string().max(255).optional(),
  nameLast: z.string().max(255).optional(),
  language: z.string().max(10).optional(),
  rootAdmin: z.union([z.boolean(), z.string()]).optional(),
  role: z.enum(['admin', 'user']).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const auth = getAuth()

  const body = await readValidatedBodyWithLimit(event, createUserSchema, BODY_SIZE_LIMITS.SMALL)
  const { username, email, password, nameFirst, nameLast, language, rootAdmin, role } = body

  if (!email) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Email is required',
    })
  }

  const finalPassword = password || randomUUID()

  try {
    const newUser = await auth.api.createUser({
      body: {
        email,
        password: finalPassword,
        name: nameFirst || nameLast ? `${nameFirst || ''} ${nameLast || ''}`.trim() : username || undefined,
        role: role || (rootAdmin === true || rootAdmin === 'true' ? 'admin' : 'user'),
        data: {
          username,
          nameFirst: nameFirst || null,
          nameLast: nameLast || null,
          language: language || 'en',
          rootAdmin: rootAdmin === true || rootAdmin === 'true',
        },
      },
      headers: event.req.headers,
    })

    if (username || nameFirst || nameLast || language || rootAdmin) {
      const db = useDrizzle()
      await db.update(tables.users)
        .set({
          ...(username && { username }),
          ...(nameFirst !== undefined && { nameFirst: nameFirst || null }),
          ...(nameLast !== undefined && { nameLast: nameLast || null }),
          ...(language && { language }),
          ...(rootAdmin !== undefined && { rootAdmin: rootAdmin === true || rootAdmin === 'true' }),
        })
        .where(eq(tables.users.id, newUser.id))
        .run()
    }

    await recordAuditEventFromRequest(event, {
      actor: session.user.email || session.user.id,
      actorType: 'user',
      action: 'admin.user.created',
      targetType: 'user',
      targetId: newUser.id,
      metadata: {
        username,
        email,
        rootAdmin: rootAdmin === true || rootAdmin === 'true',
      },
    })

    return {
      user: newUser,
      generatedPassword: password ? undefined : finalPassword,
    }
  }
  catch (error) {
    if (error instanceof APIError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message || 'Failed to create user',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create user',
    })
  }
})
