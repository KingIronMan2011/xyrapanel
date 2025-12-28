import { requireAdmin } from '~~/server/utils/security'
import { SETTINGS_KEYS, setSettings } from '~~/server/utils/settings'
import { refreshEmailService } from '~~/server/utils/email'
import type { MailSettings } from '#shared/types/admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<Partial<MailSettings>>(event)
  const updates: Record<string, string> = {}

  if (body.driver !== undefined) {
    updates[SETTINGS_KEYS.MAIL_DRIVER] = body.driver
  }

  if (body.service !== undefined) {
    updates[SETTINGS_KEYS.MAIL_SERVICE] = body.service
  }

  if (body.host !== undefined) {
    updates[SETTINGS_KEYS.MAIL_HOST] = body.host
  }

  if (body.port !== undefined) {
    updates[SETTINGS_KEYS.MAIL_PORT] = body.port
  }

  if (body.username !== undefined) {
    updates[SETTINGS_KEYS.MAIL_USERNAME] = body.username
  }

  if (body.password !== undefined) {
    updates[SETTINGS_KEYS.MAIL_PASSWORD] = body.password
  }

  if (body.encryption !== undefined) {
    updates[SETTINGS_KEYS.MAIL_ENCRYPTION] = body.encryption
  }

  if (body.fromAddress !== undefined) {
    updates[SETTINGS_KEYS.MAIL_FROM_ADDRESS] = body.fromAddress
  }

  if (body.fromName !== undefined) {
    updates[SETTINGS_KEYS.MAIL_FROM_NAME] = body.fromName
  }

  if (Object.keys(updates).length === 0) {
    throw createError({
      statusCode: 400,
      message: 'No settings to update',
    })
  }

  setSettings(updates as Record<typeof SETTINGS_KEYS[keyof typeof SETTINGS_KEYS], string>)

  refreshEmailService()

  return { success: true }
})
