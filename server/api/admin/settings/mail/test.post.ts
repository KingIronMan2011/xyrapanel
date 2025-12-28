import { requireAdmin } from '~~/server/utils/security'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)

  try {
    const { sendEmail } = await import('~~/server/utils/email')

    const appName = useRuntimeConfig().public.appName || 'XyraPanel'
    await sendEmail({
      to: session.user.email || 'admin@example.com',
      subject: `${appName} - Test Email`,
      html: `
        <h2>Test Email</h2>
        <p>This is a test email from ${appName}.</p>
        <p>If you received this, your email configuration is working correctly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
    })

    return {
      success: true,
      message: 'Test email sent successfully',
    }
  } catch (error) {
    console.error('Failed to send test email:', error)
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Failed to send test email',
    })
  }
})
