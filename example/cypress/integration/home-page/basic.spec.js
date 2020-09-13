context('Basic', () => {
  describe('Critical components exist', () => {
    it('successfully loads home page on dev server', () => {
      cy.visit('http://localhost:5001/')
    })

    it('renders a clickable log in button', () => {
      cy.get('button.auth-button')
        .contains(/log in/i)
        .click()
    })

    it('successfully loads home page on live server', () => {
      cy.visit('https://primo.af/')
    })

    it('renders a clickable log in button', () => {
      cy.get('button.auth-button')
        .contains(/log in/i)
        .click()
    })
  })
})
