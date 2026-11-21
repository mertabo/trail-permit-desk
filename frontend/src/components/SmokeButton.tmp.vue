<script setup lang="ts">
import { ref } from 'vue'

const message = ref('')

async function load() {
  const response = await fetch('/api/smoke')
  message.value = (await response.json()).message
}
</script>

<template>
  <button type="button" class="btn btn-primary" @click="load">Load message</button>
  <p v-if="message" data-test="message">{{ message }}</p>
</template>
