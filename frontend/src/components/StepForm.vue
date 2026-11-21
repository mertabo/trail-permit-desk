<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { FormValues, Step } from './stepForm'

const props = defineProps<{ steps: Step[] }>()

const form = reactive<FormValues>(Object.fromEntries(props.steps.map((step) => [step.key, null])))
const currentIndex = ref(0)
const currentStep = computed(() => props.steps[currentIndex.value])
const isLastStep = computed(() => currentIndex.value === props.steps.length - 1)
const canGoNext = computed(
  () => !isLastStep.value && currentStep.value !== undefined && form[currentStep.value.key] != null,
)

function updateCurrentStep(value: unknown) {
  const step = currentStep.value
  if (!step || JSON.stringify(form[step.key]) === JSON.stringify(value)) return
  form[step.key] = value
  // Later steps depend on this one (e.g. a new date changes which trails are available),
  // so their values are cleared.
  for (const laterStep of props.steps.slice(currentIndex.value + 1)) {
    form[laterStep.key] = null
  }
}
</script>

<template>
  <div v-if="currentStep">
    <div class="d-flex align-items-center justify-content-between gap-3 mb-3">
      <button
        type="button"
        class="btn btn-outline-secondary"
        :disabled="currentIndex === 0"
        @click="currentIndex--"
      >
        ← Previous
      </button>
      <p class="mb-0 fw-semibold text-center" aria-live="polite" data-test="step-counter">
        Step {{ currentIndex + 1 }} of {{ steps.length }}: {{ currentStep.title }}
      </p>
      <button type="button" class="btn btn-primary" :disabled="!canGoNext" @click="currentIndex++">
        Next →
      </button>
    </div>

    <div class="card">
      <div class="card-body">
        <component
          :is="currentStep.component"
          v-bind="currentStep.props?.(form)"
          :model-value="form[currentStep.key]"
          @update:model-value="updateCurrentStep"
        />
      </div>
    </div>
  </div>
</template>
