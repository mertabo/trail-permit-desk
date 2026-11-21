<script setup lang="ts">
import StepForm from '@/components/StepForm.vue'
import type { Step } from '@/components/stepForm'
import CalendarStep from '@/components/steps/CalendarStep.vue'
import TrailStep from '@/components/steps/TrailStep.vue'
import ChannelStep from '@/components/steps/ChannelStep.vue'
import PermitFormStep from '@/components/steps/PermitFormStep.vue'

// One key per form. It stays the same across steps and save attempts, so saving twice
// never creates two permits. A new one is created the next time the form opens.
const idempotencyKey = crypto.randomUUID()

const steps: Step[] = [
  { title: 'Date', key: 'date', component: CalendarStep },
  { title: 'Trail', key: 'trail', component: TrailStep, props: (form) => ({ date: form.date }) },
  { title: 'Channel', key: 'channel', component: ChannelStep, props: (form) => ({ trail: form.trail }) },
  {
    title: 'Details',
    key: 'fields',
    component: PermitFormStep,
    props: (form) => ({ date: form.date, trail: form.trail, channel: form.channel, idempotencyKey }),
  },
]
</script>

<template>
  <main class="container py-4">
    <h1 class="h3 mb-4">Request a permit</h1>
    <StepForm :steps="steps" />
  </main>
</template>
