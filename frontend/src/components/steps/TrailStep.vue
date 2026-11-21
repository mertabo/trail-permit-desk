<script setup lang="ts">
import { watch } from 'vue'
import AppLoader from '@/components/AppLoader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useRequest } from '@/composables/useRequest'
import { fetchTrailAvailability, type TrailAvailability } from '@/services/trails'
import { hikersAvailable, isFull, trailLabel } from '@/utils/trails'

const props = defineProps<{ date: string; modelValue: TrailAvailability | null }>()
const emit = defineEmits<{ 'update:modelValue': [trail: TrailAvailability] }>()

const { data: trails, loading, run } = useRequest(fetchTrailAvailability)
watch(() => props.date, (date) => run(date), { immediate: true })

// A closed trail shows CLOSED even if it's also full.
function pill(trail: TrailAvailability): 'CLOSED' | 'FULL' | null {
  if (trail.status === 'closed') return 'CLOSED'
  if (isFull(trail)) return 'FULL'
  return null
}
</script>

<template>
  <div>
    <p class="text-body-secondary">Pick a trail for {{ date }}.</p>
    <AppLoader v-if="loading" />
    <EmptyState v-else-if="trails && trails.length === 0" message="There are no trails to show." />
    <div v-else-if="trails" class="row row-cols-1 row-cols-md-2 g-3">
      <div v-for="trail in trails" :key="trail.code" class="col">
        <button
          type="button"
          class="card h-100 w-100 text-start"
          :class="{ 'border-primary bg-primary-subtle': modelValue?.code === trail.code }"
          :disabled="pill(trail) !== null"
          :aria-pressed="modelValue?.code === trail.code"
          :data-test="`trail-${trail.code}`"
          @click="emit('update:modelValue', trail)"
        >
          <span class="card-body w-100">
            <span class="d-flex justify-content-between align-items-start gap-2">
              <span class="h6 card-title mb-1">{{ trailLabel(trail) }}</span>
              <span
                v-if="pill(trail)"
                class="badge rounded-pill"
                :class="pill(trail) === 'CLOSED' ? 'text-bg-secondary' : 'text-bg-danger'"
                data-test="status-pill"
              >
                {{ pill(trail) }}
              </span>
            </span>
            <span class="d-block text-body-secondary small" data-test="available">
              {{ hikersAvailable(trail) }} of {{ trail.daily_quota }} available
            </span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card:disabled {
  opacity: 0.6;
}
</style>
