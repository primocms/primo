
context('Editor', () => {
  // beforeEach(() => {
  //   cy.visit('http://test.localhost:5001')
  // })

  describe('Creating content', () => {

    it('logs into page', () => {
      cy.visit('http://test.localhost:5001')
      cy.get('#primo-symbol').click()
      cy.get('#signin-github').click()
    })

    it('types and saves text', () => {
      const randomString = Math.random() * 5;
      const editor = cy.get('section .primo-content')
      editor.clear().type(randomString)
      cy.get('#save').click()
      cy.wait(1000)
      cy.reload()
      editor.should('contain', randomString)
    })

  })

})
