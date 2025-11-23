import { storeToRefs } from 'pinia'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  if (to.path.startsWith('/auth/') && !to.path.startsWith('/auth/password/force')) {
    return
  }

  const authStore = useAuthStore()
  const { status, requiresPasswordReset, isAuthenticated } = storeToRefs(authStore)

  if (status.value === 'loading') {
    try {
      await authStore.syncSession({ force: true })
    }
    catch {
      return
    }
  }

  if (!isAuthenticated.value) {
    return
  }

  if (!requiresPasswordReset.value) {
    return
  }

  if (to.path.startsWith('/auth/password/force')) {
    return
  }

  return navigateTo({
    path: '/auth/password/force',
    query: {
      redirect: to.fullPath,
    },
  })
})
