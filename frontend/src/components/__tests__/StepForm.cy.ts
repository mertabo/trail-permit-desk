import { defineComponent, h, type PropType } from 'vue'
import StepForm from '../StepForm.vue'
import type { Step } from '../stepForm'

// A stand-in step: shows its current value and has buttons to pick a new one.
function fakeStep(name: string, choices: string[]) {
  return defineComponent({
    props: { modelValue: { type: String as PropType<string | null>, default: null } },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
      return () =>
        h('div', [
          h('p', { 'data-test': `${name}-value` }, props.modelValue ?? 'nothing selected'),
          ...choices.map((choice) =>
            h('button', { type: 'button', onClick: () => emit('update:modelValue', choice) }, choice),
          ),
        ])
    },
  })
}

const steps: Step[] = [
  { title: 'Date', key: 'date', component: fakeStep('date', ['Dec 1', 'Dec 2']) },
  { title: 'Trail', key: 'trail', component: fakeStep('trail', ['RDG-01']) },
  { title: 'Channel', key: 'channel', component: fakeStep('channel', ['online']) },
  { title: 'Details', key: 'fields', component: fakeStep('fields', ['filled in']) },
]

it('changing the date clears the selected trail, channel and fields', () => {
  cy.mount(StepForm, { props: { steps } })

  // Fill in every step.
  cy.contains('button', 'Dec 1').click()
  cy.contains('button', 'Next').click()
  cy.contains('button', 'RDG-01').click()
  cy.contains('button', 'Next').click()
  cy.contains('button', 'online').click()
  cy.contains('button', 'Next').click()
  cy.contains('button', 'filled in').click()

  // Go back to the date and change it.
  cy.contains('button', 'Previous').click().click().click()
  cy.get('[data-test="step-counter"]').should('contain', 'Step 1 of 4')
  cy.contains('button', 'Dec 2').click()

  // Every later step is empty again, so Next stays disabled until a new choice is made.
  cy.contains('button', 'Next').click()
  cy.get('[data-test="trail-value"]').should('have.text', 'nothing selected')
  cy.contains('button', 'Next').should('be.disabled')
  cy.contains('button', 'RDG-01').click()
  cy.contains('button', 'Next').click()
  cy.get('[data-test="channel-value"]').should('have.text', 'nothing selected')
})
