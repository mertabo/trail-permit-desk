import TrailStep from '../TrailStep.vue'

const date = '2026-12-05'
const trail = (overrides: Record<string, unknown>) => ({
  code: 'RDG-01',
  name: 'Ridgeline Loop',
  daily_quota: 10,
  status: 'open',
  booked_hikers: 0,
  ...overrides,
})

function mountWith(response: Parameters<typeof cy.intercept>[2]) {
  cy.intercept('GET', `/api/trails/availability?date=${date}`, response).as('availability')
  cy.mountWithToast(TrailStep, { props: { date, modelValue: null } })
}

describe('loading, error and empty states', () => {
  it('shows a loader while the trails load', () => {
    mountWith({ body: [], delay: 500 })
    cy.get('[data-test="loader"]').should('be.visible')
    cy.wait('@availability')
    cy.get('[data-test="loader"]').should('not.exist')
  })

  it('shows the error toast when the request fails', () => {
    mountWith({ statusCode: 500, body: { code: 'SERVER_ERROR' } })
    cy.get('[data-test="toast"]').should('contain', 'Something went wrong. Please try again later.')
  })

  it('shows the empty state when there are no trails', () => {
    mountWith({ body: [] })
    cy.get('[data-test="empty-state"]').should('be.visible')
  })
})

it('shows the code when there is no name (OLD-07)', () => {
  mountWith({ body: [trail({ code: 'OLD-07', name: null })] })
  cy.get('[data-test="trail-OLD-07"]').should('contain', 'OLD-07')
})

it('shows 0 available, never negative, when booked ≥ quota', () => {
  mountWith({ body: [trail({ daily_quota: 3, booked_hikers: 5 })] })
  cy.get('[data-test="available"]').should('contain', '0 of 3 available')
})

it('FULL disables the card, including quota 0', () => {
  mountWith({
    body: [
      trail({ code: 'BRD-08', daily_quota: 3, booked_hikers: 3 }),
      trail({ code: 'LKE-06', daily_quota: 0, booked_hikers: 0 }),
    ],
  })
  for (const code of ['BRD-08', 'LKE-06']) {
    cy.get(`[data-test="trail-${code}"]`).should('be.disabled').find('[data-test="status-pill"]').should('contain', 'FULL')
  }
})

it('CLOSED disables the card and wins over FULL', () => {
  mountWith({ body: [trail({ code: 'MOS-05', status: 'closed', daily_quota: 30, booked_hikers: 30 })] })
  cy.get('[data-test="trail-MOS-05"]').should('be.disabled').find('[data-test="status-pill"]').should('contain', 'CLOSED')
})
