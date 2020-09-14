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

export function createComponent({ id, value, fields = null }) {
  if (cy.get('#single-use-component')) click('#single-use-component')
  cy.get('.CodeMirror-focused')
    .type(component(id, value), { parseSpecialCharSequences: false })
  if (fields) {
    click('#tab-fields') 
    fields.forEach(field => addField(field))
  }
}

export function typeComponent(id, content, options = {}) {
  cy.get('.CodeMirror-focused')
    .type(component(id, content), { parseSpecialCharSequences: false, ...options })
}

export function addField({ label, key, type = 'text', subfields, value }) {
  click('.field-button')
  cy.get('.field-item:last-of-type select').select(type)
  cy.get('.field-item:last-of-type input.label-input').type(label)
  cy.get('.field-item:last-of-type input.key-input').type(key)

  if (subfields) {
    subfields.forEach(({ label, key:subfieldKey, type = 'text', value }) => {
      click('button.subfield-button')
      cy.get('.field-item:last-of-type .field-container:last-of-type select').select(type)
      cy.get('.field-item:last-of-type .field-container:last-of-type .label-input').type(label)
      cy.get('.field-item:last-of-type .field-container:last-of-type .key-input').type(subfieldKey)

      if (value) {
        populateField(`${key}-${subfieldKey}`, value, true)
      }
    })
  }

  if (value) {
    populateField(key, value)
  }

  function populateField(key, value, isRepeater = false) {
    click('.switch.to-cms')
    if (isRepeater) {
      click('.field-button')
    }
    if (typeof value === 'number') {
      cy.get(`#${isRepeater ? 'repeater' : 'field'}-${key}`).clear().type(value)
    } else {
      cy.get(`#${isRepeater ? 'repeater' : 'field'}-${key}`)
        .invoke('val', value)
        .type(' ')
    }
    if (cy.get('.switch.to-ide')) {
      click('.switch.to-ide')
    } 
  }

}