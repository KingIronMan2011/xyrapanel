import { useAuthStore } from '~/stores/auth'
import { storeToRefs } from 'pinia'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  const authStore = useAuthStore()
  const { isAuthenticated, isAdmin, status } = storeToRefs(authStore)

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

  if (!isAdmin.value) {
    return navigateTo({
      path: '/',
      query: {
        error: 'admin_required',
      },
    })
  }
})

