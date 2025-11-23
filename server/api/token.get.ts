import { parseCookies } from 'h3'
import { ensureCors } from '~~/server/utils/http/cors'

export default defineEventHandler(async (event) => {
  if (ensureCors(event)) {
    return
  }

  const cookies = parseCookies(event)
  const token = cookies['better-auth.session_token']

  return token ?? null
})
