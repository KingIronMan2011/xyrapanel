import { getServerSession } from '~~/server/utils/session'
import { getServerWithAccess } from '~~/server/utils/server-helpers'
import { useDrizzle, tables, eq, and } from '~~/server/utils/drizzle'
import { requireServerPermission } from '~~/server/utils/permission-middleware'
import { TaskScheduler } from '~~/server/utils/task-scheduler'

export default defineEventHandler(async (event) => {
  const session = await getServerSession(event)
  const serverId = getRouterParam(event, 'server')
  const scheduleId = getRouterParam(event, 'schedule')

  if (!serverId || !scheduleId) {
    throw createError({
      statusCode: 400,
      message: 'Server and schedule identifiers are required',
    })
  }

  const { server } = await getServerWithAccess(serverId, session)

  await requireServerPermission(event, {
    serverId: server.id,
    requiredPermissions: ['server.schedule.update'],
  })

  const db = useDrizzle()
  const schedule = await db
    .select()
    .from(tables.serverSchedules)
    .where(
      and(
        eq(tables.serverSchedules.id, scheduleId),
        eq(tables.serverSchedules.serverId, server.id)
      )
    )
    .get()

  if (!schedule) {
    throw createError({
      statusCode: 404,
      message: 'Schedule not found',
    })
  }

  try {
    const scheduler = new TaskScheduler()
    
    const tasks = await db
      .select()
      .from(tables.serverScheduleTasks)
      .where(eq(tables.serverScheduleTasks.scheduleId, scheduleId))
      .orderBy(tables.serverScheduleTasks.sequenceId)
      .all()

    if (tasks.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Schedule has no tasks',
      })
    }

    const result = await scheduler.executeSchedule(scheduleId, true)

    return {
      data: {
        success: result.success,
        executedAt: result.executedAt,
        tasks: result.tasks.length,
        taskResults: result.tasks,
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute schedule'
    throw createError({
      statusCode: 500,
      message,
    })
  }
})
