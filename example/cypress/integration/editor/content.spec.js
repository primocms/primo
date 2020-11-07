
context('Editor', () => {

  it('types and saves text', () => {
    cy.visit('http://localhost:5000')
    const editor = cy.get('.primo-copy')
    editor.clear().type('test')
    cy.get('#save').click()
    cy.wait(500)
    cy.reload()
    cy.get('.primo-copy p').should('contain', 'test')
  })

})
