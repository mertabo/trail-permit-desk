<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { toast, hide } = useToast()
</script>

<template>
  <div class="toast-container position-fixed bottom-0 end-0 p-3">
    <div
      v-if="toast"
      :key="toast.id"
      class="toast show align-items-center border-0"
      :class="`text-bg-${toast.variant}`"
      :role="toast.variant === 'danger' ? 'alert' : 'status'"
      data-test="toast"
    >
      <div class="d-flex">
        <div class="toast-body">{{ toast.message }}</div>
        <button
          type="button"
          class="btn-close btn-close-white me-2 m-auto"
          aria-label="Close"
          @click="hide"
        ></button>
      </div>
    </div>
  </div>
</template>
