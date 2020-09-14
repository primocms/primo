
context('Editor', () => {
  describe('Creating content', () => {

    it('types and saves text', () => {
      cy.visit('http://cypress.localhost:5000')
      const randomString = Math.random() * 5;
      const editor = cy.get('.primo-content')
      editor.clear().type(randomString)
      cy.get('#save').click()
      cy.wait(500)
      cy.reload()
      cy.get('.primo-content p').should('contain', randomString)
    })

  })

})
