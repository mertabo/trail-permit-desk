import type { Component } from 'vue'

/** The values collected by the form, one per step, keyed by the step's `key`. */
export type FormValues = Record<string, unknown>

export type Step = {
  title: string
  /** Where this step's value is stored in the form values. */
  key: string
  /** Receives the step's value as `modelValue` and emits `update:modelValue`. */
  component: Component
  /** Extra props, worked out from the values of the earlier steps. */
  props?: (form: FormValues) => Record<string, unknown>
}
