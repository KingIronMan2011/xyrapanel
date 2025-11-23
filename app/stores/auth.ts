import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { SessionUser } from '#shared/types/auth'
import { authClient } from '~/utils/auth-client'

export const useAuthStore = defineStore('auth', () => {
  const sessionRef = authClient.useSession()
  const sessionData = computed(() => sessionRef.value?.data ?? null)
  const isPending = computed(() => sessionRef.value?.isPending ?? true)
  const refetchSession = async () => {
    if (sessionRef.value?.refetch) {
      await sessionRef.value.refetch()
    } else {
      try {
        await authClient.getSession()
      }
      catch (err) {
        console.error('Failed to refetch session', err)
      }
    }
  }
  
  const authStatus = computed(() => {
    if (isPending.value) return 'loading'
    if (sessionData.value) return 'authenticated'
    return 'unauthenticated'
  })

  const isSyncing = ref(false)
  const lastSyncedAt = ref<number | null>(null)
  const error = ref<string | null>(null)

  const rawUser = computed<SessionUser | null>(() => {
    const session = sessionData.value
    if (!session) return null
    const user = (session as { user?: SessionUser }).user
    return user ?? null
  })

  const user = computed(() => rawUser.value)
  const permissions = computed(() => rawUser.value?.permissions ?? [])
  const isAdmin = computed(() => rawUser.value?.role === 'admin')
  const isSuperUser = computed(() => isAdmin.value || Boolean(rawUser.value?.remember))
  const displayName = computed(() => {
    if (!rawUser.value) return null
    return rawUser.value.username || rawUser.value.email || rawUser.value.name || null
  })
  const requiresPasswordReset = computed(() => Boolean(rawUser.value?.passwordResetRequired))
  const avatar = computed(() => {
    if (!rawUser.value || !displayName.value) {
      return null
    }
    return {
      alt: displayName.value,
      text: displayName.value.slice(0, 2).toUpperCase(),
    }
  })
  const isAuthenticated = computed(() => authStatus.value === 'authenticated' && Boolean(rawUser.value))
  const isAuthenticating = computed(() => isPending.value)

  function hasPermission(required: string | string[]) {
    const values = permissions.value

    if (Array.isArray(required)) {
      return required.some(permission => values.includes(permission))
    }

    return values.includes(required)
  }

  async function syncSession(options?: { force?: boolean }) {
    const force = options?.force ?? false

    if (isSyncing.value && !force) {
      return
    }

    isSyncing.value = true
    try {
      await refetchSession()
      await new Promise(resolve => setTimeout(resolve, 50))
      
      lastSyncedAt.value = Date.now()
      error.value = null
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to refresh session'
    }
    finally {
      isSyncing.value = false
    }
  }

  async function logout() {
    error.value = null
    try {
      await authClient.signOut()
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to sign out'
      throw err
    }
  }

  async function login(identity: string, password: string, token?: string) {
    error.value = null
    try {
      const isEmail = identity.includes('@')
      
      if (isEmail) {
        const emailResult = await authClient.signIn.email({
          email: identity,
          password,
        })

        if (emailResult.error) {
          const usernameResult = await authClient.signIn.username({
            username: identity,
            password,
          })

          if (usernameResult.error) {
            error.value = emailResult.error.message || usernameResult.error.message
            return { error: emailResult.error.message || usernameResult.error.message }
          }

          if (usernameResult.data?.twoFactorRedirect && token) {
            const twoFactorResult = await authClient.twoFactor.verifyTotp({
              code: token,
              trustDevice: true,
            })

            if (twoFactorResult.error) {
              error.value = twoFactorResult.error.message
              return { error: twoFactorResult.error.message }
            }
          }

          return usernameResult
        }

        if (emailResult.data?.twoFactorRedirect && token) {
          const twoFactorResult = await authClient.twoFactor.verifyTotp({
            code: token,
            trustDevice: true,
          })

          if (twoFactorResult.error) {
            error.value = twoFactorResult.error.message
            return { error: twoFactorResult.error.message }
          }
        }

        return emailResult
      } else {
        const usernameResult = await authClient.signIn.username({
          username: identity,
          password,
        })

        if (usernameResult.error) {
          const emailResult = await authClient.signIn.email({
            email: identity,
            password,
          })

          if (emailResult.error) {
            error.value = usernameResult.error.message || emailResult.error.message
            return { error: usernameResult.error.message || emailResult.error.message }
          }

          if (emailResult.data?.twoFactorRedirect && token) {
            const twoFactorResult = await authClient.twoFactor.verifyTotp({
              code: token,
              trustDevice: true,
            })

            if (twoFactorResult.error) {
              error.value = twoFactorResult.error.message
              return { error: twoFactorResult.error.message }
            }
          }

          return emailResult
        }

        if (usernameResult.data?.twoFactorRedirect && token) {
          const twoFactorResult = await authClient.twoFactor.verifyTotp({
            code: token,
            trustDevice: true,
          })

          if (twoFactorResult.error) {
            error.value = twoFactorResult.error.message
            return { error: twoFactorResult.error.message }
          }
        }

        return usernameResult
      }
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in'
      error.value = message
      return { error: message }
    }
  }

  function $reset() {
    isSyncing.value = false
    lastSyncedAt.value = null
    error.value = null
  }

  return {
    session: sessionData,
    status: authStatus,
    user,
    permissions,
    isAdmin,
    isSuperUser,
    displayName,
    avatar,
    isAuthenticated,
    isAuthenticating,
    isSyncing,
    lastSyncedAt,
    error,
    hasPermission,
    syncSession,
    logout,
    login,
    requiresPasswordReset,
    $reset,
  }
})
