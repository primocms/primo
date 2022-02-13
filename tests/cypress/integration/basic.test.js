/// <reference types="cypress" />

describe('Component Editor', () => {

  context('IDE', () => {


    it('Renders the toolbar', () => {
      cy.visit('http://localhost:3000/demo')
      cy.get('#primo-toolbar')
    })

    beforeEach(() => {
      // open the component editor
    })

    it('adds HTML', () => {
      cy.get('.primo-section .buttons button:last-child').click() // Select component option
      cy.get('.library-buttons button:first-child').click() // 'Create Component'
      cy.get('#primo-modal .switch').click() // Switch to IDE
      
      // HTML 
      const HTMLEditor = () => cy.get('.left > .tabs > .codemirror-container > .s-B2X_fEQqhJxq > .cm-editor > .cm-scroller > .cm-content > .cm-activeLine')
      HTMLEditor().click() // Click in HTML (todo: add id)
      HTMLEditor().type(`<h1>T`)
      getIframeBody('iframe[title="Preview HTML"]').find('h1').should('have.text', 'T')

    })

    it('adds CSS', () => {

      // CSS 
      const CSSEditor = () => cy.get('.center > .tabs > .codemirror-container > .s-B2X_fEQqhJxq > .cm-editor > .cm-scroller > .cm-content > .cm-activeLine')
      CSSEditor().click() // Click in CSS (todo: add id)
      CSSEditor().type(`h1 { color: blue }`, { parseSpecialCharSequences: false })
      getIframeBody('iframe[title="Preview HTML"]').find('h1.svelte-p3s2lp')

    })

    it('adds JS', () => {
      const JSEditor = () => cy.get('.right > .tabs > .codemirror-container > .s-B2X_fEQqhJxq > .cm-editor > .cm-scroller > .cm-content > .cm-activeLine')
      JSEditor().click() // Click in JS (todo: add id)
      JSEditor().type(`document.querySelector('h1.svelte-p3s2lp').innerText = 'replaced with JS'`)
      getIframeBody('iframe[title="Preview HTML"]').find('h1.svelte-p3s2lp').should('have.text', 'replaced with JS')

    })

    it('integrates fields', () => {

      // Integrate fields
    })
  })

  context('Page and Site CSS', () => {
    beforeEach(() => {
      // open the CSS modal
    })

    it('renders the site preview', () => {

    })
  })

  // TODO: Set up tests to protect against breaking things during i18n refactoring

  function getIframeDocument(selector) {
    return cy
    .get(selector)
    // Cypress yields jQuery element, which has the real
    // DOM element under property "0".
    // From the real DOM iframe element we can get
    // the "document" element, it is stored in "contentDocument" property
    // Cypress "its" command can access deep properties using dot notation
    // https://on.cypress.io/its
    .its('0.contentDocument').should('exist')
  }

  function getIframeBody(selector) {
    // get the document
    return getIframeDocument(selector)
    // automatically retries until body is loaded
    .its('body').should('not.be.undefined')
    // wraps "body" DOM element to allow
    // chaining more Cypress commands, like ".find(...)"
    .then(cy.wrap)
  }
})
