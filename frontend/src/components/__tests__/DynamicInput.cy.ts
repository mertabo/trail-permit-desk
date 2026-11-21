import DynamicInput from '../DynamicInput.vue'

const field = (overrides: Record<string, unknown>) => ({ key: 'f', label: 'Field', type: 'text', required: false, ...overrides })

const renderedElement: Record<string, string> = {
  text: 'input[type="text"]',
  email: 'input[type="email"]',
  number: 'input[type="number"]',
  tel: 'input[type="tel"]',
  checkbox: 'input[type="checkbox"]',
  select: 'select',
  textarea: 'textarea',
}

it('renders each supported type, and nothing for an unsupported type', () => {
  for (const [type, selector] of Object.entries(renderedElement)) {
    cy.mount(DynamicInput, { props: { field: field({ type, options: [] }), modelValue: null } })
    cy.get(selector).should('exist')
  }

  cy.mount(DynamicInput, { props: { field: field({ type: 'date' }), modelValue: null } })
  cy.get('[data-cy-root]').find('input, select, textarea, label').should('not.exist')
})

const rules = [
  { rule: 'required', field: field({ label: 'Lead hiker name', required: true }), value: '', message: 'Lead hiker name is required.' },
  { rule: 'min', field: field({ label: 'Party size', type: 'number', min: 1 }), value: 0, message: 'Party size must be at least 1.' },
  { rule: 'max (available slots)', field: field({ label: 'Party size', type: 'number', min: 1 }), value: 9, max: 6, message: "Party size can't be more than 6." },
  { rule: 'max_length', field: field({ label: 'Notes', max_length: 3 }), value: 'abcd', message: 'Notes must be 3 characters or fewer.' },
  { rule: 'pattern', field: field({ label: 'Ranger initials', pattern: '^[A-Z]{2,3}$' }), value: 'ab', message: "Ranger initials isn't in the right format." },
  { rule: 'email format', field: field({ label: 'Email', type: 'email' }), value: 'not-an-email', message: 'Enter a valid email address.' },
]

for (const { rule, field, value, max, message } of rules) {
  it(`shows the validation message for ${rule}`, () => {
    cy.mount(DynamicInput, { props: { field, modelValue: value, max, showErrors: true } })
    cy.get('[data-test="field-error"]').should('contain', message)
  })
}
