<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import DynamicInput from '@/components/DynamicInput.vue'
import { useRequest } from '@/composables/useRequest'
import { useToast } from '@/composables/useToast'
import type { Channel, ChannelField } from '@/services/channels'
import { createPermit } from '@/services/permits'
import type { TrailAvailability } from '@/services/trails'
import { availableSlots, trailLabel } from '@/utils/trails'
import { validateField, validateSchoolFields } from '@/utils/validateField'

const props = defineProps<{
  date: string
  trail: TrailAvailability
  channel: Channel
  idempotencyKey: string
  modelValue: Record<string, unknown> | null
}>()
const emit = defineEmits<{ 'update:modelValue': [fields: Record<string, unknown>] }>()

const router = useRouter()
const { showSuccess } = useToast()
const { loading: saving, run: save } = useRequest(createPermit)

const fields = computed(() => props.modelValue ?? {})
const slots = computed(() => availableSlots(props.trail, props.channel))
const showErrors = ref(false)

// party_size can't go above the spots this channel can still book on this trail.
const maxFor = (field: ChannelField) => (field.key === 'party_size' ? slots.value : undefined)

function updateField(key: string, value: unknown) {
  emit('update:modelValue', { ...fields.value, [key]: value })
}

async function onSave() {
  const hasErrors = props.channel.fields.some((field) => validateField(field, fields.value[field.key], maxFor(field)))
  // if (props.channel.id === 'school') {
  //   validateSchoolFields(fields.value as unknown as ChannelField[])
  // }
  if (hasErrors) {
    showErrors.value = true
    return
  }

  const permit = await save({
    idempotency_key: props.idempotencyKey,
    trail: props.trail.code,
    date: props.date,
    channel: props.channel.id,
    fields: fields.value,
  })
  if (permit) {
    showSuccess('Permit requested successfully')
    router.push('/')
  }
}
</script>

<template>
  <form novalidate @submit.prevent="onSave">
    <p class="text-body-secondary">
      {{ trailLabel(trail) }} on {{ date }}, via {{ channel.label }}. Up to {{ slots }} hikers.
    </p>

    <!-- One form for every channel: the fields come from the channel's config. -->
    <DynamicInput
      v-for="field in channel.fields"
      :key="field.key"
      :field="field"
      :model-value="fields[field.key]"
      :max="maxFor(field)"
      :show-errors="showErrors"
      @update:model-value="updateField(field.key, $event)"
    />

    <p v-if="channel.id === 'school'">Total party size: {{ Number(fields.students || 0) + Number(fields.chaperones || 0) }}</p>

    <button type="submit" class="btn btn-primary" :disabled="saving" data-test="save">
      <span v-if="saving" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      {{ saving ? 'Saving…' : 'Save' }}
    </button>
  </form>
</template>
