<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { authClient } from '~/utils/auth-client'
import type { AccountSessionsResponse, UserSessionSummary } from '#shared/types/auth'

definePageMeta({
  auth: true,
})

const sessions = ref<UserSessionSummary[]>([])
const sessionsError = ref<string | null>(null)
const currentSessionToken = ref<string | null>(null)
const updatingSessions = ref(false)

const hasSessions = computed(() => sessions.value.length > 0)
const toast = useToast()

const authStore = useAuthStore()
const { status } = storeToRefs(authStore)

const {
  data: sessionsResponse,
  pending: sessionsPending,
  error: sessionsFetchError,
  execute: fetchSessions,
} = useLazyFetch<AccountSessionsResponse>('/api/account/sessions', {
  server: false,
  immediate: false,
  cache: 'no-cache',
  retry: 0,
})

watch(sessionsResponse, (response) => {
  if (!response)
    return

  sessions.value = response.data
  currentSessionToken.value = response.currentToken
})

watch(sessionsFetchError, (err) => {
  if (!err) {
    sessionsError.value = null
    return
  }

  const message = err instanceof Error ? err.message : 'Unable to load sessions.'
  sessionsError.value = message
})

watch(status, async (value, previous) => {
  if (value === 'authenticated') {
    await authStore.syncSession()
    await fetchSessions()
    return
  }

  if (value === 'unauthenticated' && previous === 'authenticated') {
    sessions.value = []
    currentSessionToken.value = null
    sessionsError.value = 'You need to sign in to view sessions.'
  }
}, { immediate: true })

async function loadSessions() {
  await authStore.syncSession()
  await fetchSessions()
}

const sortedSessions = computed(() => (
  [...sessions.value].sort((a, b) => b.expiresAtTimestamp - a.expiresAtTimestamp)
))

const revealedIps = ref<Record<string, boolean>>({})

function maskIp(ip: string) {
  if (!ip || ip === 'Unknown') return 'Unknown'
  if (ip.includes(':')) {
    const segments = ip.split(':')
    return segments.slice(0, 4).join(':') + '::'
  }
  const parts = ip.split('.')
  if (parts.length !== 4) return ip
  return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`
}

function isIpRevealed(token: string) {
  return revealedIps.value[token] === true
}

function toggleIpReveal(token: string) {
  revealedIps.value = {
    ...revealedIps.value,
    [token]: !isIpRevealed(token),
  }
}

function displayIp(ip: string, token: string) {
  if (!ip || ip === 'Unknown') return 'Unknown'
  return isIpRevealed(token) ? ip : maskIp(ip)
}

async function handleSignOut(token: string) {
  if (updatingSessions.value) return

  updatingSessions.value = true
  try {
    let currentSessionRevoked = false
    
    if (typeof authClient.revokeSession === 'function') {
      try {
        await authClient.revokeSession({ token })
        const cookies = document.cookie.split(';').find(c => c.trim().startsWith('better-auth.session_token='))
        const currentToken = cookies?.split('=')[1]
        currentSessionRevoked = currentToken === token
      }
      catch {
        const result = await $fetch<{ revoked: boolean, currentSessionRevoked: boolean }>(`/api/account/sessions/${encodeURIComponent(token)}`, {
          method: 'DELETE',
        })
        currentSessionRevoked = result.currentSessionRevoked
      }
    }
    else {
      const result = await $fetch<{ revoked: boolean, currentSessionRevoked: boolean }>(`/api/account/sessions/${encodeURIComponent(token)}`, {
        method: 'DELETE',
      })
      currentSessionRevoked = result.currentSessionRevoked
    }

    if (currentSessionRevoked) {
      await navigateTo('/auth/login')
      return
    }

    await loadSessions()
    toast.add({
      title: 'Session revoked',
      description: 'The selected session has been signed out.',
    })
  }
  catch (error) {
    toast.add({
      title: 'Failed to revoke session',
      description: error instanceof Error ? error.message : 'Unable to revoke selected session.',
      color: 'error',
    })
  }
  finally {
    updatingSessions.value = false
  }
}

async function handleSignOutAll(includeCurrent = false) {
  if (updatingSessions.value) return

  updatingSessions.value = true
  try {
    if (includeCurrent) {
      await authClient.signOut()
      await navigateTo('/auth/login')
      return
    }

    if (typeof authClient.revokeOtherSessions === 'function') {
      try {
        await authClient.revokeOtherSessions()
        await loadSessions()
        toast.add({
          title: 'Sessions revoked',
          description: 'All other sessions have been revoked.',
        })
        return
      }
      catch {
      }
    }

    const result = await $fetch<{ revoked: number, currentSessionRevoked: boolean }>('/api/account/sessions', {
      method: 'DELETE',
      query: { includeCurrent: 'false' },
    })

    await loadSessions()
    toast.add({
      title: 'Sessions revoked',
      description: result.revoked > 0
        ? `Revoked ${result.revoked} session${result.revoked === 1 ? '' : 's'}.`
        : 'No sessions were revoked.',
    })
  }
  catch (error) {
    toast.add({
      title: 'Failed to revoke sessions',
      description: error instanceof Error ? error.message : 'Unable to revoke sessions.',
      color: 'error',
    })
  }
  finally {
    updatingSessions.value = false
  }
}
</script>

<template>
  <UPage>
    <UContainer>
      <UPageHeader
        title="Sessions"
        description="Manage devices currently authenticated with your XyraPanel account."
      >
        <template #links>
          <UButton
            variant="ghost"
            color="neutral"
            :loading="updatingSessions"
            :disabled="!hasSessions || updatingSessions"
            @click="handleSignOutAll(false)"
          >
            Sign out others
          </UButton>
          <UButton
            variant="soft"
            color="neutral"
            :loading="updatingSessions"
            :disabled="!hasSessions || updatingSessions"
            @click="handleSignOutAll(true)"
          >
            Sign out all
          </UButton>
        </template>
      </UPageHeader>
    </UContainer>

    <UPageBody>
      <UContainer>
        <UCard :ui="{ body: 'space-y-3' }">
          <template #header>
            <div>
              <h2 class="text-lg font-semibold">Active sessions</h2>
              <p class="text-sm text-muted-foreground">Browser tokens issued for your account.</p>
            </div>
          </template>

          <div v-if="sessionsPending" class="space-y-3">
            <USkeleton v-for="i in 3" :key="`session-skeleton-${i}`" class="h-16 w-full rounded-lg" />
          </div>
          <UAlert v-else-if="sessionsError" icon="i-lucide-alert-triangle" color="error" :title="sessionsError" />
          <UEmpty
            v-else-if="!hasSessions"
            icon="i-lucide-monitor"
            title="No active sessions"
            description="No browser sessions found for your account"
            variant="subtle"
          />
          <div v-else class="space-y-2">
            <div
              v-for="session in sortedSessions"
              :key="session.token"
              class="flex items-center gap-3 rounded-lg border border-default p-3 transition-colors hover:bg-elevated/50"
            >
              <UIcon
                :name="session.device === 'Mobile' ? 'i-lucide-smartphone' : session.device === 'Tablet' ? 'i-lucide-tablet' : 'i-lucide-monitor'"
                class="size-5 shrink-0 text-primary"
              />
              
              <div class="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-2 md:gap-4 items-center">
                <div class="min-w-0 flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-medium">{{ session.device ?? 'Unknown' }}</span>
                  <span class="text-xs text-muted-foreground">{{ session.os ?? 'Unknown' }} • {{ session.browser ?? 'Unknown' }}</span>
                  <UBadge v-if="session.token === currentSessionToken" color="primary" variant="soft" size="xs" class="shrink-0">
                    Current
                  </UBadge>
                </div>

                <div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground min-w-0">
                  <div class="flex items-center gap-1 shrink-0">
                    <span class="truncate">IP: {{ displayIp(session.ipAddress ?? 'Unknown', session.token) }}</span>
                    <UButton variant="link" size="xs" class="h-auto p-0 min-w-0" @click="toggleIpReveal(session.token)">
                      {{ isIpRevealed(session.token) ? 'Hide' : 'Show' }}
                    </UButton>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <span class="truncate">
                      Active:
                      <template v-if="session.lastSeenAt">
                        <NuxtTime :datetime="session.lastSeenAt" class="font-medium" />
                      </template>
                      <span v-else>Unknown</span>
                    </span>
                    <span class="hidden sm:inline">•</span>
                    <span class="truncate">
                      Expires:
                      <template v-if="session.expiresAtTimestamp">
                        <NuxtTime :datetime="session.expiresAtTimestamp * 1000" class="font-medium" />
                      </template>
                      <span v-else>Unknown</span>
                    </span>
                  </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <UButton
                    variant="ghost"
                    color="error"
                    size="xs"
                    :loading="updatingSessions"
                    :disabled="session.token === currentSessionToken && updatingSessions"
                    @click="handleSignOut(session.token)"
                  >
                    Revoke
                  </UButton>
                </div>
              </div>
            </div>

            <details v-if="sortedSessions.some(s => s.token === currentSessionToken)" class="text-xs border border-default rounded-lg p-3">
              <summary class="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                Show current session details
              </summary>
              <div class="mt-3 space-y-2 text-muted-foreground">
                <div>
                  <strong>Token:</strong>
                  <code class="block mt-1 break-all text-xs bg-muted p-2 rounded">{{ sortedSessions.find(s => s.token === currentSessionToken)?.token }}</code>
                </div>
                <div>
                  <strong>User Agent:</strong>
                  <span class="block mt-1 break-all">{{ sortedSessions.find(s => s.token === currentSessionToken)?.userAgent }}</span>
                </div>
                <div>
                  <strong>Issued:</strong>
                  <template v-if="sortedSessions.find(s => s.token === currentSessionToken)?.issuedAt">
                    <NuxtTime
                      :datetime="sortedSessions.find(s => s.token === currentSessionToken)?.issuedAt || ''"
                      relative
                      class="ml-1 font-medium"
                    />
                  </template>
                  <span v-else class="ml-1">Unknown</span>
                </div>
              </div>
            </details>
          </div>
        </UCard>
      </UContainer>
    </UPageBody>
  </UPage>
</template>
