/// <reference types="cypress" />

context('Page & Site options', () => {

  it('Renders the toolbar', () => {
    cy.visit('http://localhost:5174')
    cy.get('#primo-toolbar')
    cy.get('#ide-toggle label.switch').click()
  })

  it('Adds Page HTML', () => {
    cy.get("button#toolbar--html").click(); 
    cy.get('.editor-head [contenteditable="true"]').type('<span id="test-page-head"></')
    cy.get('.editor-body [contenteditable="true"]').type('<span id="test-page-body">test page body</')
    cy.get('.primo-button.primary').click()
    cy.get('head #test-page-head')
    cy.get('#test-page-body')
  })

  it('Adds Site HTML', () => {
    cy.get("button#toolbar--html").click(); 
    cy.get("button#tab-site").click(); 
    cy.get('.editor-head [contenteditable="true"]').type('{moveToStart}<span id="test-site-head"></{enter}')
    cy.get('.editor-body [contenteditable="true"]').type('<span id="test-site-body">test site body</')
    cy.get('.primo-button.primary').click()
    cy.get('head #test-site-head')
    cy.get('#test-site-body')
  })

})