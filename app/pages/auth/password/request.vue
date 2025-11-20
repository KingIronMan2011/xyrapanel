<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  auth: false,
})

const toast = useToast()
const router = useRouter()

const schema = z.object({
  identity: z.string().trim().min(1, 'Enter your username or email address'),
})

type FormSchema = z.infer<typeof schema>

const form = reactive<FormSchema>({
  identity: '',
})

const isSubmitting = ref(false)

async function handleSubmit(event: FormSubmitEvent<FormSchema>) {
  if (isSubmitting.value)
    return

  isSubmitting.value = true

  try {
    await $fetch('/api/auth/password/request', {
      method: 'POST',
      body: {
        identity: event.data.identity.trim(),
      },
    })

    toast.add({
      title: 'Check your inbox',
      description: 'If the account exists, a reset email has been sent.',
      color: 'success',
    })

    router.push('/auth/login')
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process request.'
    toast.add({
      title: 'Request failed',
      description: message,
      color: 'error',
    })
  }
  finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="space-y-2 text-center">
      <h1 class="text-2xl font-semibold text-white">Reset your password</h1>
      <p class="text-sm text-muted-foreground">
        Enter the email address or username associated with your account.
      </p>
    </div>

    <UForm
      :schema="schema"
      :state="form"
      class="space-y-4"
      :disabled="isSubmitting"
      :validate-on="['input']"
      @submit="handleSubmit"
    >
      <UFormField label="Username or email" name="identity" required>
        <UInput
          v-model="form.identity"
          placeholder="username or you@example.com"
          :disabled="isSubmitting"
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" variant="subtle" block :loading="isSubmitting">
        Send reset link
      </UButton>
    </UForm>

    <p class="text-center text-sm text-muted-foreground">
      <NuxtLink to="/auth/login" class="text-primary underline-offset-4 hover:underline">
        Back to sign in
      </NuxtLink>
    </p>
  </div>
</template>
