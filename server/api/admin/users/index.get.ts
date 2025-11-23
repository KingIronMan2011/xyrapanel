import { createError } from 'h3'
import { APIError } from 'better-auth/api'
import { getAuth } from '~~/server/utils/auth'

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

  const query = getQuery(event)
  
  const searchValue = query.search as string | undefined
  const searchField = (query.searchField as 'email' | 'name' | undefined) || 'name'
  const searchOperator = (query.searchOperator as 'contains' | 'starts_with' | 'ends_with' | undefined) || 'contains'
  const limit = query.limit ? Number(query.limit) : 25
  const offset = query.offset ? Number(query.offset) : (query.page ? (Number(query.page) - 1) * limit : 0)
  const sortBy = (query.sortBy as string | undefined) || 'createdAt'
  const sortDirection = (query.sortDirection as 'asc' | 'desc' | undefined) || 'desc'
  const filterField = query.filterField as string | undefined
  const filterValue = query.filterValue as string | number | boolean | undefined
  const filterOperator = (query.filterOperator as 'eq' | 'ne' | 'lt' | 'lte' | 'gt' | 'gte' | undefined) || 'eq'

  try {
    const result = await auth.api.listUsers({
      query: {
        ...(searchValue && { searchValue, searchField, searchOperator }),
        limit,
        offset,
        sortBy,
        sortDirection,
        ...(filterField && filterValue !== undefined && { filterField, filterValue, filterOperator }),
      },
      headers: event.req.headers,
    })

    return {
      data: result.users || [],
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total: result.total || 0,
        totalPages: Math.ceil((result.total || 0) / limit),
      },
    }
  }
  catch (error) {
    if (error instanceof APIError) {
      throw createError({
        statusCode: error.statusCode,
        statusMessage: error.message || 'Failed to list users',
      })
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list users',
    })
  }
})
