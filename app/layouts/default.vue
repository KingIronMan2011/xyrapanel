<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import type { NavigationMenuItem } from '@nuxt/ui'
import { authClient } from '~/utils/auth-client'

const { data: sessionData } = await authClient.useSession(useFetch)

const authStore = useAuthStore()
const { user, displayName, avatar, isAdmin: isAdminRef, isAuthenticated } = storeToRefs(authStore)
const signOutLoading = ref(false)

async function handleSignOut() {
  if (signOutLoading.value) {
    return
  }

  signOutLoading.value = true
  try {
    await authStore.logout()
    await navigateTo('/auth/login')
  }
  catch (error) {
    console.error('Failed to sign out', error)
    signOutLoading.value = false
  }
}

const navigationItems = computed<NavigationMenuItem[]>(() => {
  const items: NavigationMenuItem[] = [
    {
      label: 'Dashboard',
      to: '/',
    },
    {
      label: 'Servers',
      to: '/server',
    },
    {
      label: 'Account',
      children: [
        { label: 'Profile', to: '/account/profile' },
        { label: 'Security', to: '/account/security' },
        { label: 'API Keys', to: '/account/api-keys' },
        { label: 'SSH Keys', to: '/account/ssh-keys' },
        { label: 'Sessions', to: '/account/sessions' },
        { label: 'Activity', to: '/account/activity' },
      ],
    },
  ]

  return items
})

const userLabel = computed(() => {
  if (!isAuthenticated.value || !user.value) {
    return null
  }
  
  if (displayName.value && displayName.value.length > 0) {
    return displayName.value
  }
  
  if (user.value) {
    return user.value.username || user.value.email || user.value.name || null
  }
  
  return null
})

const userAvatar = computed(() => {
  if (!isAuthenticated.value || !user.value) {
    return null
  }
  return avatar.value
})
const isAdminUser = computed(() => {
  if (isAdminRef.value) return true
  if (user.value?.role === 'admin') return true
  return false
})
</script>

<template>
  <UDashboardGroup class="min-h-screen bg-muted/30" storage="local" storage-key="client-dashboard">
    <UDashboardSidebar
      collapsible
      :toggle="{ icon: 'i-lucide-menu', label: 'Navigation', color: 'neutral', variant: 'ghost' }"
      :ui="{ footer: 'border-t border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink v-if="!collapsed" to="/" class="group inline-flex items-center gap-2">
          <h1 class="text-lg font-semibold text-muted-foreground group-hover:text-foreground transition">
            XyraPanel
          </h1>
        </NuxtLink>
        <UIcon v-else name="i-simple-icons-nuxtdotjs" class="mx-auto size-5 text-primary" />
      </template>

      <template #default="{ collapsed }">
        <UNavigationMenu :collapsed="collapsed" :items="navigationItems" orientation="vertical" />
      </template>

      <template #footer="{ collapsed }">
        <template v-if="isAuthenticated && user && userLabel">
          <UDropdownMenu
            :items="[[
              { label: 'Profile', to: '/account/profile' },
              { label: 'Security', to: '/account/security' },
              { label: 'API Keys', to: '/account/api-keys' },
              { label: 'SSH Keys', to: '/account/ssh-keys' },
              { label: 'Sessions', to: '/account/sessions' },
              { label: 'Activity', to: '/account/activity' }
            ], [
              { label: 'Sign out', click: handleSignOut, color: 'error' }
            ]]"
          >
            <UButton
              color="neutral"
              variant="ghost"
              class="w-full"
              :block="collapsed"
              type="button"
              @click.prevent
            >
              <template #leading>
                <UAvatar v-if="userAvatar" v-bind="userAvatar" size="sm" />
              </template>
              <span v-if="!collapsed && userLabel">{{ userLabel }}</span>
            </UButton>
          </UDropdownMenu>
        </template>
        <template v-else>
          <UButton
            color="error"
            variant="ghost"
            class="w-full"
            :block="collapsed"
            to="/auth/login"
          >
            <template #leading>
              <UIcon name="i-lucide-log-in" class="size-4" />
            </template>
            <span v-if="!collapsed">Sign in</span>
          </UButton>
        </template>
      </template>
    </UDashboardSidebar>

    <UDashboardPanel :ui="{ body: 'flex flex-1 flex-col p-0' }">
      <template #body>
        <UDashboardNavbar>
          <template #right>
            <div class="flex items-center gap-2">
              <UButton v-if="isAdminUser" icon="i-lucide-shield" variant="ghost" color="error" to="/admin">
                Admin
              </UButton>
              <UButton icon="i-lucide-log-out" color="primary" variant="subtle" :loading="signOutLoading"
                @click="handleSignOut">
                Sign out
              </UButton>
            </div>
          </template>
        </UDashboardNavbar>

        <main class="flex-1 overflow-y-auto">
          <div class="mx-auto w-full max-w-6xl px-6 py-8">
            <slot />
          </div>
        </main>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
