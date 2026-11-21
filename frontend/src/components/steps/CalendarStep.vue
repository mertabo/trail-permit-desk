<script setup lang="ts">
import { BOOKING_WINDOW_DAYS } from '@/config'
import { computeDateRange, toDateString } from '@/utils/dates'

defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [date: string] }>()

const months = computeDateRange(BOOKING_WINDOW_DAYS, new Date())
</script>

<template>
  <div>
    <p class="text-body-secondary">Pick the day of your hike.</p>
    <section v-for="group in months" :key="`${group.year}-${group.monthNumber}`" class="mb-3">
      <h2 class="h6 mb-2">{{ group.month }} {{ group.year }}</h2>
      <div class="calendar-grid">
        <button
          v-for="day in group.days"
          :key="day"
          type="button"
          class="btn"
          :class="
            modelValue === toDateString(group.year, group.monthNumber, day)
              ? 'btn-primary'
              : 'btn-outline-primary'
          "
          :aria-pressed="modelValue === toDateString(group.year, group.monthNumber, day)"
          :aria-label="`${group.month} ${day}, ${group.year}`"
          @click="emit('update:modelValue', toDateString(group.year, group.monthNumber, day))"
        >
          {{ day }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.5rem;
}
</style>
