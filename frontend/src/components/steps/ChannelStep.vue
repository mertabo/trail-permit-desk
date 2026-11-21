<script setup lang="ts">
import AppLoader from '@/components/AppLoader.vue'
import EmptyState from '@/components/EmptyState.vue'
import { useRequest } from '@/composables/useRequest'
import { fetchChannels, type Channel } from '@/services/channels'
import type { TrailAvailability } from '@/services/trails'
import { availableSlots, trailLabel } from '@/utils/trails'

defineProps<{ trail: TrailAvailability; modelValue: Channel | null }>()
const emit = defineEmits<{ 'update:modelValue': [channel: Channel] }>()

const { data: channels, loading, run } = useRequest(fetchChannels)
run()
</script>

<template>
  <div>
    <p class="text-body-secondary">How are you requesting a permit for {{ trailLabel(trail) }}?</p>
    <AppLoader v-if="loading" />
    <EmptyState v-else-if="channels && channels.length === 0" message="There are no channels to show." />
    <div v-else-if="channels" class="row row-cols-1 row-cols-md-3 g-3">
      <div v-for="channel in channels" :key="channel.id" class="col">
        <button
          type="button"
          class="card h-100 w-100 text-start"
          :class="{ 'border-primary bg-primary-subtle': modelValue?.id === channel.id }"
          :aria-pressed="modelValue?.id === channel.id"
          :data-test="`channel-${channel.id}`"
          @click="emit('update:modelValue', channel)"
        >
          <span class="card-body w-100">
            <span class="d-block h6 card-title mb-1">{{ channel.label }}</span>
            <span class="d-block text-body-secondary small" data-test="slots">
              Up to {{ availableSlots(trail, channel) }} hikers
            </span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>
