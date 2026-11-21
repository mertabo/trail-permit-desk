<script setup lang="ts">
withDefaults(defineProps<{ message?: string }>(), { message: 'Nothing to show here yet.' })
</script>

<template>
  <div class="text-center text-body-secondary py-4" data-test="empty-state">
    <p class="mb-0">{{ message }}</p>
  </div>
</template>
