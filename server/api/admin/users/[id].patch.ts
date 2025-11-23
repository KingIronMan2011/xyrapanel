import { createError } from 'h3'
import { APIError } from 'better-auth/api'
import { getAuth } from '~~/server/utils/auth'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
import type { UpdateUserRequest } from '#shared/types/user'
import { recordAuditEventFromRequest } from '~~/server/utils/audit'

export default defineEventHandler(async (event) => {
  const auth = getAuth()
  
  const session = await auth.api.getSession({
    headers: event.req.headers,
  })

  if (!session?.user?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden', message: 'Admin access required' })
  }

  const userId = getRouterParam(event, 'id')
  if (!userId) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request', message: 'User ID is required' })
  }

  const body = await readBody<Partial<UpdateUserRequest>>(event)

  try {
    const updateData: Record<string, unknown> = {}
    
    if (body.nameFirst !== undefined || body.nameLast !== undefined) {
      const name = [body.nameFirst, body.nameLast].filter(Boolean).join(' ') || undefined
      if (name) updateData.name = name
    }

    if (body.email !== undefined) {
      const currentUser = await auth.api.getUser({
        query: { userId },
        headers: event.req.headers,
      }).catch(() => null)
      
      if (currentUser && currentUser.email !== body.email) {
        await auth.api.changeEmail({
          body: {
            newEmail: body.email,
          },
          headers: event.req.headers,
        })
      }
    }

    if (body.role !== undefined) {
      await auth.api.setRole({
        body: {
          userId,
          role: body.role,
        },
        headers: event.req.headers,
      })
    }

    if (body.password) {
      await auth.api.setUserPassword({
        body: {
          userId,
          newPassword: body.password,
        },
        headers: event.req.headers,
      })
    }

    if (body.username !== undefined || body.rootAdmin !== undefined) {
      const db = useDrizzle()
      const updates: Partial<typeof tables.users.$inferInsert> = {
        updatedAt: new Date(),
      }
      
      if (body.username !== undefined) updates.username = body.username
      if (body.rootAdmin !== undefined) updates.rootAdmin = body.rootAdmin
      
      await db.update(tables.users)
        .set(updates)
        .where(eq(tables.users.id, userId))
        .run()
    }

    await recordAuditEventFromRequest(event, {
      actor: session.user.email || session.user.id,
      actorType: 'user',
      action: 'admin.user.updated',
      targetType: 'user',
      targetId: userId,
      metadata: {
        fields: Object.keys(body),
      },
    })

    const updatedUser = await auth.api.getUser({
      query: { userId },
      headers: event.req.headers,
    }).catch(() => null)

    if (!updatedUser) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found after update' })
    }

    return {
      data: {
        id: updatedUser.id,
        username: (updatedUser as { username?: string }).username || updatedUser.email,
        email: updatedUser.email,
        name: updatedUser.name || null,
        role: (updatedUser as { role?: string }).role || 'user',
        createdAt: updatedUser.createdAt?.toISOString() || new Date().toISOString(),
      },
    }
  }
  catch (error) {
    if (error instanceof APIError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message || 'Failed to update user',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update user',
    })
  }
})
