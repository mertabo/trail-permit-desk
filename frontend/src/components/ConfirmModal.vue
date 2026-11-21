<script setup lang="ts">
defineProps<{ title: string; message: string; confirmLabel: string; cancelLabel: string; busy?: boolean }>()
const emit = defineEmits<{ confirm: []; close: [] }>()
</script>

<template>
  <div
    class="modal d-block"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-modal-title"
    data-test="confirm-modal"
    @keydown.esc="emit('close')"
  >
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="confirm-modal-title" class="modal-title h5">{{ title }}</h2>
          <button type="button" class="btn-close" aria-label="Close" :disabled="busy" @click="emit('close')"></button>
        </div>
        <div class="modal-body">
          <p class="mb-0">{{ message }}</p>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="emit('close')">
            {{ cancelLabel }}
          </button>
          <button type="button" class="btn btn-danger" :disabled="busy" data-test="confirm" @click="emit('confirm')">
            <span v-if="busy" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal-backdrop show"></div>
</template>
