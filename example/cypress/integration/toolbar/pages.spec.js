
context('Site Pages', () => {

  it('creates a new page', () => {
    cy.visit('http://cypress.localhost:5000')
    cy.get('#pages').click()
    cy.get('.primary-button').click()
    cy.get('#page-label input').type('Test Page')
    cy.get('#page-url input').type('test-page')
    cy.get('.primary-button').click()
  })

  it('navigates to the new page', () => {
    navigateToPage('test-page')
  })

  it('deletes the new page', () => {
    cy.get('#pages').click()
    navigateToPage('index')
    cy.get('#pages').click()
    cy.get('button.delete-page').click()
    cy.get('li#page-test-page').should('not.exist');
  })

})

function navigateToPage(id) {
  cy.get(`li#page-${id} button.page-preview`).click()
}