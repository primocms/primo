
context('Editor', () => {

  it('types and saves text', () => {
    cy.visit('http://cypress.localhost:5000')
    const editor = cy.get('.primo-content')
    editor.clear().type('test')
    cy.get('#save').click()
    cy.wait(500)
    cy.reload()
    cy.get('.primo-content p').should('contain', 'test')
  })

})
