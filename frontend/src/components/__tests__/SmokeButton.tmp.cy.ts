import SmokeButton from '../SmokeButton.tmp.vue'

it('shows the message from the API after clicking the button', () => {
  cy.intercept('GET', '/api/smoke', { message: 'Hello from Postgres' })
  cy.mount(SmokeButton)
  cy.contains('button', 'Load message').click()
  cy.get('[data-test="message"]').should('have.text', 'Hello from Postgres')
})
