<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({
  layout: 'auth',
  auth: false,
})

const toast = useToast()
const router = useRouter()
const route = useRoute()

const schema = z.object({
  token: z.string().trim().min(1, 'Reset token is required'),
  password: z.string().min(12, 'Password must be at least 12 characters long'),
  confirmPassword: z.string().min(12, 'Password must be at least 12 characters long'),
}).superRefine((value, ctx) => {
  if (value.password !== value.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['confirmPassword'],
      message: 'Passwords do not match',
    })
  }
})

type FormSchema = z.infer<typeof schema>

const form = reactive<FormSchema>({
  token: typeof route.query.token === 'string' ? route.query.token : '',
  password: '',
  confirmPassword: '',
})

watch(() => route.query.token, (value) => {
  if (typeof value === 'string')
    form.token = value
})

const isSubmitting = ref(false)

async function handleSubmit(event: FormSubmitEvent<FormSchema>) {
  if (isSubmitting.value)
    return

  isSubmitting.value = true

  try {
    await $fetch('/api/auth/password/reset', {
      method: 'POST',
      body: {
        token: event.data.token,
        newPassword: event.data.password,
      },
    })

    toast.add({
      title: 'Password updated',
      description: 'You can now sign in with your new password.',
      color: 'success',
    })

    router.push('/auth/login')
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset password.'
    toast.add({
      title: 'Reset failed',
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
      <h1 class="text-2xl font-semibold text-white">Set a new password</h1>
      <p class="text-sm text-muted-foreground">
        Enter your reset token and choose a new password.
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
      <UFormField label="Reset token" name="token" required>
        <UInput
          v-model="form.token"
          placeholder="Paste the token from your email"
          :disabled="isSubmitting"
        />
      </UFormField>

      <UFormField label="New password" name="password" required>
        <UInput
          v-model="form.password"
          type="password"
          placeholder="••••••••••••"
          :disabled="isSubmitting"
        />
      </UFormField>

      <UFormField label="Confirm password" name="confirmPassword" required>
        <UInput
          v-model="form.confirmPassword"
          type="password"
          placeholder="Re-enter your password"
          :disabled="isSubmitting"
        />
      </UFormField>

      <UButton type="submit" block :loading="isSubmitting">
        Update password
      </UButton>
    </UForm>

    <p class="text-center text-sm text-muted-foreground">
      <NuxtLink to="/auth/login" class="text-primary underline-offset-4 hover:underline">
        Back to sign in
      </NuxtLink>
    </p>
  </div>
</template>
