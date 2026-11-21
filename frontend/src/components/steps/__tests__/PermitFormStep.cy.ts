import { defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import channelsFile from '../../../../../data/channels.json'
import { errorMessage } from '@/errorMessages'
import type { Channel } from '@/services/channels'
import type { TrailAvailability } from '@/services/trails'
import PermitFormStep from '../PermitFormStep.vue'

const channels = channelsFile.channels as Channel[]
const online = channels.find((channel) => channel.id === 'online')!
const trail: TrailAvailability = { code: 'RDG-01', name: 'Ridgeline Loop', daily_quota: 45, status: 'open', booked_hikers: 0 }
const idempotencyKey = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f'

function mountForm(channel: Channel) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: {} }] })
  // Stand-in for the parent form: keeps the field values the step emits and passes them back in.
  const Host = defineComponent({
    setup() {
      const fields = ref<Record<string, unknown>>({})
      return () =>
        h(PermitFormStep, {
          date: '2026-12-05',
          trail,
          channel,
          idempotencyKey,
          modelValue: fields.value,
          'onUpdate:modelValue': (value: Record<string, unknown>) => (fields.value = value),
        })
    },
  })
  cy.mountWithToast(Host, { global: { plugins: [router] } })
}

function fillOnlineForm() {
  cy.get('#field-lead_name').type('Ana Reyes')
  cy.get('#field-email').type('ana@example.com')
  cy.get('#field-party_size').type('2')
  cy.get('#field-emergency_phone').type('+63 912 345 6789')
}

for (const channel of channels) {
  it(`renders the right fields for the ${channel.label} channel`, () => {
    mountForm(channel)
    for (const field of channel.fields) cy.contains('label', field.label).should('exist')
  })
}

it('renders a made-up fourth channel from config alone, with no code changes', () => {
  const school: Channel = {
    id: 'school',
    label: 'School group',
    max_party: 30,
    fields: [
      { key: 'teacher_name', label: 'Teacher in charge', type: 'text', required: true },
      { key: 'grade', label: 'Grade', type: 'select', required: true, options: [{ value: '5', label: 'Grade 5' }] },
      { key: 'party_size', label: 'Party size', type: 'number', required: true, min: 1 },
    ],
  }
  mountForm(school)

  cy.contains('label', 'Teacher in charge').should('exist')
  cy.get('#field-grade').find('option').should('contain', 'Grade 5')
  cy.contains('label', 'Party size').should('exist')
})

it('clicking Save again sends the same idempotency key', () => {
  cy.intercept('POST', '/api/permits', { statusCode: 500, body: { code: 'SERVER_ERROR' } }).as('save')
  mountForm(online)
  fillOnlineForm()

  cy.get('[data-test="save"]').click()
  cy.wait('@save').its('request.body.idempotency_key').should('eq', idempotencyKey)
  cy.get('[data-test="save"]').should('not.be.disabled').click()
  cy.wait('@save').its('request.body.idempotency_key').should('eq', idempotencyKey)
})

const codes = ['TRAIL_CLOSED', 'TRAIL_FULL', 'DUPLICATE_BOOKING', 'VALIDATION_ERROR', 'SERVER_ERROR', 'SOMETHING_NEW']

for (const code of codes) {
  it(`shows the plain-language message for ${code}`, () => {
    cy.intercept('POST', '/api/permits', { statusCode: 409, body: { code } })
    mountForm(online)
    fillOnlineForm()

    cy.get('[data-test="save"]').click()
    cy.get('[data-test="toast"]').should('contain', errorMessage(code))
  })
}
