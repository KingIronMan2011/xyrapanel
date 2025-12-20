import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import type { H3Event } from 'h3'

const defineEventHandlerStub = (handler: (event: H3Event) => Promise<unknown>) => handler
vi.stubGlobal('defineEventHandler', defineEventHandlerStub)

const mockReadValidatedBody = vi.fn<
  (event: H3Event, parser: (payload: unknown) => unknown) => Promise<{ newPassword: string }>
>()
const mockAssertMethod = vi.fn<(event: H3Event, method: string) => void>()

type MockH3Error = { statusCode: number; statusMessage: string; message?: string }

vi.mock('h3', () => ({
  assertMethod: mockAssertMethod,
  createError: (err: MockH3Error) => err,
  readValidatedBody: mockReadValidatedBody,
  defineEventHandler: (handler: (event: H3Event) => Promise<unknown>) => handler,
}))

const mockGetServerSession = vi.fn()
vi.mock('~~/server/utils/session', () => ({
  getServerSession: mockGetServerSession,
}))

const mockResolveSessionUser = vi.fn()
vi.mock('~~/server/utils/auth/sessionUser', () => ({
  resolveSessionUser: mockResolveSessionUser,
}))

interface SelectRow {
  password: string
  passwordResetRequired: boolean
}

const mockUseDrizzle = vi.fn<() => ReturnType<typeof createDb>>()
vi.mock('~~/server/utils/drizzle', () => ({
  useDrizzle: mockUseDrizzle,
  tables: {
    users: {
      id: Symbol('users.id'),
      password: Symbol('users.password'),
      passwordResetRequired: Symbol('users.passwordResetRequired'),
    },
    sessions: {
      userId: Symbol('sessions.userId'),
    },
  },
  eq: (...args: unknown[]) => args,
}))

const mockRecordAudit = vi.fn<(event: H3Event, payload: Record<string, unknown>) => Promise<void>>(() => Promise.resolve())
vi.mock('~~/server/utils/audit', () => ({
  recordAuditEventFromRequest: mockRecordAudit,
}))

const mockBcrypt = {
  hash: vi.fn(async () => 'hashed-password'),
  compare: vi.fn(async () => false),
}
vi.mock('bcryptjs', () => ({
  default: mockBcrypt,
}))

type Handler = (event: H3Event) => Promise<unknown>
let handler: Handler

function createDb(selectResult: SelectRow | undefined, deletedChanges = 1) {
  const selectBuilder = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    get: vi.fn(() => selectResult),
  }

  const updateRun = vi.fn()
  const updateBuilder = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn(() => ({
      run: updateRun,
    })),
  }

  const deleteBuilder = {
    where: vi.fn(() => ({
      run: vi.fn(() => ({ changes: deletedChanges })),
    })),
  }

  return {
    select: vi.fn(() => selectBuilder),
    update: vi.fn(() => updateBuilder),
    delete: vi.fn(() => deleteBuilder),
  }
}

const baseEvent: H3Event = {
  node: { req: { method: 'PUT', headers: {} } },
  context: {},
} as unknown as H3Event

describe('account/password/force.put handler', () => {
  beforeAll(async () => {
    handler = (await import('../../../server/api/account/password/force.put.ts')).default as Handler
  })

  beforeEach(() => {
    vi.resetAllMocks()
    mockReadValidatedBody.mockResolvedValue({ newPassword: 'new-password' })
    mockGetServerSession.mockResolvedValue({ session: { id: 'session-1' } })
    mockResolveSessionUser.mockReturnValue({
      id: 'user-1',
      email: 'user@example.com',
    })
  })

  it('updates password, clears reset flag, and records audit event', async () => {
    mockUseDrizzle.mockReturnValue(
      createDb({
        password: 'old-hash',
        passwordResetRequired: true,
      }, 2),
    )

    const result = await handler(baseEvent)

    expect(mockAssertMethod).toHaveBeenCalledWith(baseEvent, 'PUT')
    expect(mockGetServerSession).toHaveBeenCalled()
    expect(mockResolveSessionUser).toHaveBeenCalled()
    expect(mockBcrypt.compare).toHaveBeenCalledWith('new-password', 'old-hash')
    expect(mockBcrypt.hash).toHaveBeenCalledWith('new-password', 12)
    expect(mockRecordAudit).toHaveBeenCalledWith(baseEvent, expect.objectContaining({
      action: 'account.password.force_update',
      metadata: { revokedSessions: 2 },
    }))
    expect(result).toEqual({ success: true, revokedSessions: 2 })
  })

  it('rejects when password reset is not required', async () => {
    mockUseDrizzle.mockReturnValue(
      createDb({
        password: 'old-hash',
        passwordResetRequired: false,
      }),
    )

    await expect(handler(baseEvent)).rejects.toMatchObject({
      statusCode: 400,
      statusMessage: 'Bad Request',
    })
    expect(mockBcrypt.hash).not.toHaveBeenCalled()
  })
})
