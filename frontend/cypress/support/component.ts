import 'bootstrap/dist/css/bootstrap.min.css'

import { mount } from 'cypress/vue'
import { defineComponent, h, type Component } from 'vue'
import AppToast from '@/components/AppToast.vue'
import { useToast } from '@/composables/useToast'

type MountOptions = {
  props?: Record<string, unknown>
  global?: { plugins?: unknown[] }
}

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
      /** Mounts a component next to the app's toast, so tests can check toast messages. */
      mountWithToast(component: Component, options?: MountOptions): Chainable
    }
  }
}

Cypress.Commands.add('mount', mount)

Cypress.Commands.add('mountWithToast', (component: Component, options: MountOptions = {}) => {
  useToast().hide() // the toast is shared app state, so start every test without one
  const Wrapper = defineComponent({
    setup: () => () => h('div', [h(component, options.props), h(AppToast)]),
  })
  return cy.mount(Wrapper, { global: options.global } as Parameters<typeof mount>[1])
})
