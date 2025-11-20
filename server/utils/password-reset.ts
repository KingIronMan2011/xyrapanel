import { randomUUID } from 'node:crypto'
import { generateRawToken, hashToken } from '~~/server/utils/crypto'
import { useDrizzle, tables, eq, lt, and, isNull } from '~~/server/utils/drizzle'
import type { PasswordResetRow } from '~~/server/database/schema'

const RESET_EXPIRATION_MS = 60 * 60 * 1000

function getExpiry(): Date {
  return new Date(Date.now() + RESET_EXPIRATION_MS)
}

export function purgeExpiredPasswordResets(): void {
  const db = useDrizzle()
  const now = new Date()

  db.delete(tables.passwordResets)
    .where(lt(tables.passwordResets.expiresAt, now))
    .run()
}

export async function createPasswordResetToken(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const db = useDrizzle()
  const now = new Date()
  const expiresAt = getExpiry()

  purgeExpiredPasswordResets()

  db.delete(tables.passwordResets)
    .where(eq(tables.passwordResets.userId, userId))
    .run()

  const rawToken = generateRawToken()
  const hashedToken = hashToken(rawToken)

  db.insert(tables.passwordResets)
    .values({
      id: randomUUID(),
      userId,
      token: hashedToken,
      expiresAt,
      usedAt: null,
      createdAt: now,
    })
    .run()

  return { token: rawToken, expiresAt }
}

export function getValidPasswordReset(token: string): PasswordResetRow | null {
  if (!token || token.length === 0) {
    return null
  }

  purgeExpiredPasswordResets()

  const db = useDrizzle()
  const hashedToken = hashToken(token)

  const reset = db
    .select()
    .from(tables.passwordResets)
    .where(eq(tables.passwordResets.token, hashedToken))
    .get()

  if (!reset) {
    return null
  }

  if (reset.usedAt) {
    return null
  }

  if (reset.expiresAt <= new Date()) {
    return null
  }

  return reset
}

export function markPasswordResetUsed(id: string, userId: string): void {
  const db = useDrizzle()
  const now = new Date()

  db.update(tables.passwordResets)
    .set({ usedAt: now })
    .where(eq(tables.passwordResets.id, id))
    .run()

  db.delete(tables.passwordResets)
    .where(and(eq(tables.passwordResets.userId, userId), isNull(tables.passwordResets.usedAt)))
    .run()
}
