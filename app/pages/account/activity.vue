<script setup lang="ts">
import { computed } from 'vue'
import type { AccountActivityResponse } from '#shared/types/account'

definePageMeta({
  auth: true,
})

const {
  data: activityResponse,
  pending: loading,
  error: fetchError,
} = await useFetch<AccountActivityResponse>('/api/account/activity', {
  key: 'account-activity',
})

const entries = computed(() => activityResponse.value?.data ?? [])
const generatedAt = computed(() => activityResponse.value?.generatedAt ?? null)
const generatedAtDate = computed(() => (generatedAt.value ? new Date(generatedAt.value) : null))
const error = computed(() => {
  if (!fetchError.value) return null
  return fetchError.value instanceof Error ? fetchError.value.message : 'Failed to load account activity.'
})

function formatTarget(target: string | null) {
  return target ?? 'No target recorded'
}

</script>

<template>
  <UPage>
    <UContainer>
      <UPageHeader title="Account activity">
        <template #description>
          <span>
            Personal actions you've taken across XyraPanel. Use this log to verify recent changes and sign-ins. Updated
            <NuxtTime
              v-if="generatedAtDate"
              :datetime="generatedAtDate"
              relative
              class="font-medium"
            />
            <span v-else>recently</span>
          </span>
        </template>
      </UPageHeader>
    </UContainer>

    <UPageBody>
      <UContainer>
        <UCard :ui="{ body: 'space-y-3' }">
          <template #header>
            <h2 class="text-lg font-semibold">Recent activity</h2>
          </template>

          <template v-if="loading">
            <div class="space-y-2">
              <USkeleton v-for="i in 5" :key="`activity-skeleton-${i}`" class="h-14 w-full" />
            </div>
          </template>
          <template v-else-if="error">
            <div class="rounded-lg border border-dashed border-default p-4 text-sm text-destructive">
              {{ error }}
            </div>
          </template>
          <UEmpty
            v-else-if="entries.length === 0"
            icon="i-lucide-activity"
            title="No activity yet"
            description="Your account activity will appear here"
            variant="subtle"
          />
          <template v-else>
            <div class="space-y-3">
              <div
                v-for="entry in entries"
                :key="entry.id"
                class="flex flex-col gap-2 rounded-lg border border-default p-3 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p class="text-sm font-medium">{{ entry.action }}</p>
                  <p class="text-xs text-muted-foreground">{{ formatTarget(entry.target) }}</p>
                </div>
                <div class="text-xs text-muted-foreground">
                  <NuxtTime :datetime="entry.occurredAt" relative />
                </div>
              </div>
            </div>
          </template>
        </UCard>
      </UContainer>
    </UPageBody>
  </UPage>
</template>
