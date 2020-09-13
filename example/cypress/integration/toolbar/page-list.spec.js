
context('Page List', () => {

  describe('Page Creation', () => {
    
    it('opens the Page List modal', () => {
      cy.visit('http://test.localhost:5001')
      cy.get('button#pages').click()
      cy.get('.modal-title').contains('Pages')
    })

    it('shows the home page', () => {
      cy.wait(1000)
      cy.get('.card-body').contains('Homepage')
    })

    it('creates a new page', () => {
      cy.get('button#new-page').click()
      cy.get('#page-title input').type('Test Page')
      cy.get('#page-url input').type('test-page')
      cy.get('#page-base button:last-child').click()
      cy.get('#create-page').click()
    })

    it('shows the new page', () => {
      cy.get('li#page-test-page').contains('Test Page')
    })

    it('delets the new page', () => {
      cy.get('button.delete-page').click()
      cy.get('li#page-test-page').should('not.exist');
    })

    it('closes the modal', () => {
      cy.get('button#close-modal').click()
      cy.get('.modal').should('not.exist');
    })

  })

})
