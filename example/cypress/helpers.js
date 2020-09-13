export function click(selector) {
  cy.get(selector)
    .click()
}

export function navigateToPage(pageId) {
  click('#pages')
  click(`#page-${pageId} button.page-preview`)
}

export function createPage(pageLabel, pageId) {
  click('#new-page')
  cy.get('#page-label input').type(pageLabel)
  cy.get('#page-url input').type(pageId)
  cy.get('#page-base button:last-child').click()
  click('#create-page')
}

export const component = (id, content) => `<div id="${id}" class="w-full p-24 bg-blue-500 font-bold text-5xl text-white text-center">${content}</div>`

export function typeComponent(id, content, options = {}) {
  cy.get('.CodeMirror-focused')
    // .click()
    .type(component(id, content), { parseSpecialCharSequences: false, ...options })
}

