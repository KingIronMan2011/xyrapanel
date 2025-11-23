import { useAuthStore } from '~/stores/auth'
import { storeToRefs } from 'pinia'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  if (to.path.startsWith('/auth/')) {
    return
  }

  const authStore = useAuthStore()
  const { isAuthenticated, status } = storeToRefs(authStore)

  if (status.value === 'loading') {
    await authStore.syncSession({ force: true })
  }

  if (!isAuthenticated.value) {
    return navigateTo({
      path: '/auth/login',
      query: {
        redirect: to.fullPath,
      },
    })
  }
})