import { createError } from 'h3'
import { APIError } from 'better-auth/api'
import { getAuth } from '~~/server/utils/auth'
import { useDrizzle, tables, eq } from '~~/server/utils/drizzle'
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
    throw createError({
      statusCode: 403,
      statusMessage: 'Forbidden',
      message: 'Admin access required',
    })
  }

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'User ID is required',
    })
  }

  const body = await readBody(event)
  const { username, email, password, nameFirst, nameLast, language, rootAdmin, role } = body

  try {
    const updateData: Record<string, string | undefined> = {}
    
    if (nameFirst !== undefined || nameLast !== undefined) {
      const name = [nameFirst, nameLast].filter(Boolean).join(' ') || undefined
      if (name) updateData.name = name
    }

    if (Object.keys(updateData).length > 0) {
      await auth.api.adminUpdateUser({
        body: {
          userId: id,
          data: updateData,
        },
        headers: event.req.headers,
      })
    }

    if (email !== undefined) {
      const currentUser = await auth.api.getUser({
        query: { userId: id },
        headers: event.req.headers,
      }).catch(() => null)
      
      if (currentUser && currentUser.email !== email) {
        await auth.api.changeEmail({
          body: {
            newEmail: email,
          },
          headers: event.req.headers,
        })
      }
    }

    if (role !== undefined) {
      await auth.api.setRole({
        body: {
          userId: id,
          role,
        },
        headers: event.req.headers,
      })
    }

    if (password) {
      await auth.api.setUserPassword({
        body: {
          userId: id,
          newPassword: password,
        },
        headers: event.req.headers,
      })
    }

    const db = useDrizzle()
    const updates: Partial<typeof tables.users.$inferInsert> = {
      updatedAt: new Date(),
    }
    
    if (username !== undefined) updates.username = username
    if (language !== undefined) updates.language = language
    if (rootAdmin !== undefined) updates.rootAdmin = rootAdmin === true || rootAdmin === 'true'
    if (nameFirst !== undefined) updates.nameFirst = nameFirst || null
    if (nameLast !== undefined) updates.nameLast = nameLast || null

    if (Object.keys(updates).length > 1) {
      await db.update(tables.users)
        .set(updates)
        .where(eq(tables.users.id, id))
        .run()
    }

    await recordAuditEventFromRequest(event, {
      actor: session.user.email || session.user.id,
      actorType: 'user',
      action: 'admin.user.updated',
      targetType: 'user',
      targetId: id,
      metadata: {
        fields: Object.keys(body),
      },
    })

    const user = db
      .select({
        id: tables.users.id,
        username: tables.users.username,
        email: tables.users.email,
        nameFirst: tables.users.nameFirst,
        nameLast: tables.users.nameLast,
        language: tables.users.language,
        rootAdmin: tables.users.rootAdmin,
        role: tables.users.role,
        emailVerified: tables.users.emailVerified,
        image: tables.users.image,
        createdAt: tables.users.createdAt,
        updatedAt: tables.users.updatedAt,
      })
      .from(tables.users)
      .where(eq(tables.users.id, id))
      .get()

    if (!user) {
      throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'User not found' })
    }

    return { user }
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
