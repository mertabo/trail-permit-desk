<script setup lang="ts" generic="Item">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { Action } from './actions'

const props = defineProps<{ item: Item; actions: Action<Item>[]; label: string }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const available = computed(() => props.actions.filter((action) => action.isAvailable(props.item)))

function choose(action: Action<Item>) {
  open.value = false
  action.run(props.item)
}

// Close the menu when clicking anywhere else.
function onDocumentClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}
document.addEventListener('click', onDocumentClick)
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <!-- No available actions: no menu at all. -->
  <div v-if="available.length > 0" ref="root" class="dropdown" @keydown.esc="open = false">
    <button
      type="button"
      class="btn btn-sm btn-outline-secondary"
      :aria-label="label"
      aria-haspopup="true"
      :aria-expanded="open"
      data-test="actions-button"
      @click="open = !open"
    >
      ⋯
    </button>
    <ul class="dropdown-menu dropdown-menu-end" :class="{ show: open }">
      <li v-for="action in available" :key="action.label">
        <button type="button" class="dropdown-item" @click="choose(action)">{{ action.label }}</button>
      </li>
    </ul>
  </div>
</template>
