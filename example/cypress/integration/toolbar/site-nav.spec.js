
context('Site Navigation', () => {

  describe('Creating Nav items', () => {
    
    it('opens the Site Settings modal', () => {
      cy.visit('http://test.localhost:5001')
      cy.get('button#site-settings').click()
      cy.get('.modal-title').contains('Site Settings')
    })

    it('adds a nav item', () => {

    })

    it('edits the nav item', () => {

    })

    it('adds three more nav items', () => {

    })

    it('deletes the second nav item', () => {

    })

    it('shows the nav items on modal reopen', () => {

    })

    it('shows the nav items on reload', () => {

    })

  })

  describe('Using the nav items in a component', () => {

    it('creates a component which uses `nav`', () => {

    })

    it('shows the nav items in preview', () => {

    })

    it('saves the component', () => {

    })

  })

  describe('Using nav across pages', () => {

    it('creates another component which uses `nav`', () => {

    })

    it('shows the nav items in preview', () => {

    })

    it('saves the component', () => {

    })

    it('changes a nav item', () => {

    })

    it('reflects the change on the page', () => {

    })

    it('reflects the change on the original page', () => {

    })
    
  })

  describe('Using nav in Symbols', () => {

    it('creates a symbol which uses `nav`', () => {

    })

    it('saves the symbol, shows the nav', () => {

    })

    it('changes a nav item', () => {

    })

    it('reflects the change in the symbol', () => {

    })

  })

})
