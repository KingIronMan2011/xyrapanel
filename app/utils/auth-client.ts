import { createAuthClient } from 'better-auth/vue'
import { usernameClient, twoFactorClient , customSessionClient , apiKeyClient , jwtClient , adminClient  } from 'better-auth/client/plugins'
import type { auth } from '~~/server/utils/auth'

export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
      },
    }),
    apiKeyClient(),
    jwtClient(),
    adminClient(),
    customSessionClient<typeof auth>(),
  ],
})