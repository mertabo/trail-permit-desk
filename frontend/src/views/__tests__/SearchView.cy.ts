import SearchView from '../SearchView.vue'

const SEARCH = '/api/permits/search'

const permit = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  trail: 'RDG-01',
  trail_name: 'Ridgeline Loop',
  trail_status: 'open',
  date: '2026-12-05',
  party_size: 2,
  status: 'active',
  ...overrides,
})

const result = (items: unknown[], total: number, page = 1) => ({ items, total, page, page_size: 10 })

function searchFor(email: string) {
  cy.get('#search-email').clear().type(email)
  cy.contains('button', 'Search').click()
}

describe('loading, error and empty states', () => {
  it('shows a loader while searching', () => {
    cy.intercept({ pathname: SEARCH }, { body: result([], 0), delay: 500 }).as('search')
    cy.mountWithToast(SearchView)
    searchFor('ana@example.com')
    cy.get('[data-test="loader"]').should('be.visible')
    cy.wait('@search')
    cy.get('[data-test="loader"]').should('not.exist')
  })

  it('shows the error toast when the search fails', () => {
    cy.intercept({ pathname: SEARCH }, { statusCode: 500, body: { code: 'SERVER_ERROR' } })
    cy.mountWithToast(SearchView)
    searchFor('ana@example.com')
    cy.get('[data-test="toast"]').should('contain', 'Something went wrong. Please try again later.')
  })

  it('shows the empty state when the email has no permits', () => {
    cy.intercept({ pathname: SEARCH }, result([], 0))
    cy.mountWithToast(SearchView)
    searchFor('nobody@example.com')
    cy.get('[data-test="empty-state"]').should('be.visible')
  })
})

it('shows Active, Expired and Cancelled statuses, and the CLOSED pill for a closed trail', () => {
  const items = [
    permit(1, { status: 'active' }),
    permit(2, { status: 'expired', date: '2025-06-01' }),
    permit(3, { status: 'cancelled', trail: 'MOS-05', trail_name: 'Moss Gully', trail_status: 'closed' }),
  ]
  cy.intercept({ pathname: SEARCH }, result(items, 3))
  cy.mountWithToast(SearchView)
  searchFor('ana@example.com')

  cy.get('[data-test="permit-1"]').should('contain', 'Active')
  cy.get('[data-test="permit-2"]').should('contain', 'Expired')
  cy.get('[data-test="permit-3"]').should('contain', 'Cancelled').find('[data-test="closed-pill"]').should('contain', 'CLOSED')
})

it('clicking Next loads the next page. Pagination is hidden when total ≤ 10.', () => {
  const page1 = Array.from({ length: 10 }, (_, i) => permit(i + 1))
  const page2 = Array.from({ length: 5 }, (_, i) => permit(i + 11))
  cy.intercept({ pathname: SEARCH, query: { page: '1' } }, result(page1, 15, 1))
  cy.intercept({ pathname: SEARCH, query: { page: '2' } }, result(page2, 15, 2)).as('page2')
  cy.mountWithToast(SearchView)
  searchFor('ana@example.com')

  cy.get('tbody tr').should('have.length', 10)
  cy.contains('button', 'Next').click()
  cy.wait('@page2')
  cy.get('tbody tr').should('have.length', 5)
  cy.get('[data-test="permit-11"]').should('exist')
  cy.get('[aria-current="page"]').should('contain', '2')

  cy.intercept({ pathname: SEARCH }, result([permit(99)], 1))
  searchFor('small@example.com')
  cy.get('[data-test="permit-99"]').should('exist')
  cy.get('nav[aria-label="Search results pages"]').should('not.exist')
})

it('a new search goes back to page 1', () => {
  const many = Array.from({ length: 10 }, (_, i) => permit(i + 1))
  cy.intercept({ pathname: SEARCH, query: { page: '1' } }, result(many, 15, 1)).as('page1')
  cy.intercept({ pathname: SEARCH, query: { page: '2' } }, result([permit(11)], 15, 2)).as('page2')
  cy.mountWithToast(SearchView)
  searchFor('ana@example.com')
  cy.wait('@page1')
  cy.contains('button', 'Next').click()
  cy.wait('@page2')

  searchFor('ben@example.com')

  cy.wait('@page1').its('request.query').should('deep.equal', { email: 'ben@example.com', page: '1' })
})
