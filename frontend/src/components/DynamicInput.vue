<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ChannelField } from '@/services/channels'
import { validateField } from '@/utils/validateField'

const SUPPORTED_TYPES = ['text', 'email', 'number', 'tel', 'checkbox', 'select', 'textarea']

const props = defineProps<{
  field: ChannelField
  modelValue: unknown
  /** Extra upper limit for number fields (party_size: the available slots). */
  max?: number
  /** Show the validation message even if the field hasn't been touched (e.g. after Save). */
  showErrors?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const id = computed(() => `field-${props.field.key}`)
const touched = ref(false)
const error = computed(() => validateField(props.field, props.modelValue, props.max))
const visibleError = computed(() => (touched.value || props.showErrors ? error.value : null))

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  if (props.field.type === 'checkbox') emit('update:modelValue', input.checked)
  else if (props.field.type === 'number') emit('update:modelValue', input.value === '' ? null : Number(input.value))
  else emit('update:modelValue', input.value)
}
</script>

<template>
  <div v-if="SUPPORTED_TYPES.includes(field.type)" class="mb-3">
    <div v-if="field.type === 'checkbox'" class="form-check">
      <input
        :id="id"
        type="checkbox"
        class="form-check-input"
        :class="{ 'is-invalid': visibleError }"
        :checked="modelValue === true"
        :aria-invalid="!!visibleError"
        @change="onInput"
        @blur="touched = true"
      />
      <label class="form-check-label" :for="id">{{ field.label }}</label>
    </div>

    <template v-else>
      <label class="form-label" :for="id">
        {{ field.label }}<span v-if="field.required" class="text-danger" aria-hidden="true"> *</span>
      </label>
      <textarea
        v-if="field.type === 'textarea'"
        :id="id"
        class="form-control"
        :class="{ 'is-invalid': visibleError }"
        rows="3"
        :value="(modelValue as string) ?? ''"
        :aria-required="field.required"
        :aria-invalid="!!visibleError"
        :aria-describedby="visibleError ? `${id}-error` : undefined"
        @input="onInput"
        @blur="touched = true"
      ></textarea>
      <select
        v-else-if="field.type === 'select'"
        :id="id"
        class="form-select"
        :class="{ 'is-invalid': visibleError }"
        :value="(modelValue as string) ?? ''"
        :aria-required="field.required"
        :aria-invalid="!!visibleError"
        :aria-describedby="visibleError ? `${id}-error` : undefined"
        @change="onInput"
        @blur="touched = true"
      >
        <option value="">Choose…</option>
        <option v-for="option in field.options" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <input
        v-else
        :id="id"
        :type="field.type"
        class="form-control"
        :class="{ 'is-invalid': visibleError }"
        :value="modelValue ?? ''"
        :min="field.min"
        :max="max"
        :aria-required="field.required"
        :aria-invalid="!!visibleError"
        :aria-describedby="visibleError ? `${id}-error` : undefined"
        @input="onInput"
        @blur="touched = true"
      />
    </template>

    <div v-if="visibleError" :id="`${id}-error`" class="invalid-feedback d-block" data-test="field-error">
      {{ visibleError }}
    </div>
  </div>
</template>
