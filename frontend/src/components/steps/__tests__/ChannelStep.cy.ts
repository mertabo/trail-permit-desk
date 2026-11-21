import ChannelStep from '../ChannelStep.vue'

const channels = [
  { id: 'online', label: 'Online', max_party: 6, fields: [] },
  { id: 'operator', label: 'Tour operator', max_party: 12, fields: [] },
]

// Available slots = min(max_party, hikers still available on the trail).
const cases = [
  { name: "max_party is smaller", hikersLeft: 20, expected: { online: 6, operator: 12 } },
  { name: 'the remaining quota is smaller', hikersLeft: 4, expected: { online: 4, operator: 4 } },
]

for (const { name, hikersLeft, expected } of cases) {
  it(`available slots are min(max_party, remaining quota) when ${name}`, () => {
    cy.intercept('GET', '/api/channels', channels)
    const trail = { code: 'RDG-01', name: 'Ridgeline Loop', daily_quota: 45, status: 'open', booked_hikers: 45 - hikersLeft }
    cy.mountWithToast(ChannelStep, { props: { trail, modelValue: null } })

    cy.get('[data-test="channel-online"] [data-test="slots"]').should('contain', `Up to ${expected.online} hikers`)
    cy.get('[data-test="channel-operator"] [data-test="slots"]').should('contain', `Up to ${expected.operator} hikers`)
  })
}
