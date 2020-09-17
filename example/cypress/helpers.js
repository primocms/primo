export function click(selector) {
  cy.get(selector)
    .click()
}

export function navigateToPage(pageId) {
  click('#pages')
  click(`#page-${pageId} button.page-container`)
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

  if (value && type !== 'repeater') {
    populateField(key, value)
  }

  if (subfields) {
    // const subfieldValues = []
    subfields.forEach(({ label, key:subfieldKey, type = 'text', value }, i) => {
      click('button.subfield-button')
      cy.get('.field-item:last-of-type .field-container:last-of-type select').select(type)
      cy.get('.field-item:last-of-type .field-container:last-of-type .label-input').type(label)
      cy.get('.field-item:last-of-type .field-container:last-of-type .key-input').type(subfieldKey)
      // if (value) subfieldValues.push({ id: `${key}-${i}-${subfieldKey}`, value })
      // if (value) {
      //   populateField(`${key}-${i}-${subfieldKey}`, value, true)
      // }
    })
    click('.switch.to-cms')
    value.forEach((item, i) => {
      click('.field-button')
      subfields.forEach(({ key:subfieldKey }) => {
        const value = item[subfieldKey]
        populateSubfield(`${key}-${i}-${subfieldKey}`, value)
      })
    })
    click('.switch.to-ide')
  }

  function populateField(key, value) {
    click('.switch.to-cms')
    cy.get(`#field-${key} input`).clear().type(value)
    click('.switch.to-ide')
  }

  function populateSubfield(key, value) {
    cy.get(`#repeater-${key} input`).clear().type(value)
  }

}