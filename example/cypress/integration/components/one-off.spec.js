import { click, navigateToPage, createPage, typeComponent } from '../../helpers'

const testComponent = `\
{{heading}}<br>\
{{#each test-repeater}}\
  {{test-text}} & {{test-number}}\
{{/each}}\
`

context('Components', () => {

  describe('Creating a single-use component', () => {

    it('creates a component', () => {
      cy.visit('http://cypress.localhost:5000')
      click('#single-use-component')
      // cy.wait(1000)
      typeComponent('single-use', testComponent)
    })

    it('adds and populates a text field', () => {
      addField({
        label: 'Heading',
        key: 'heading'
      })
      click('button.switch')
      populateField('input#content-field-heading', 'Test heading')
    })

    it('adds and populates a repeater field', () => {
      click('button.switch')
      addField({
        type: 'repeater',
        label: 'Test Repeater',
        key: 'test-repeater',
        subfields: [
          {
            label: 'Repeater Text',
            key: 'test-text'
          },
          {
            label: 'Repeater Number',
            key: 'test-number'
          }
        ]
      })
      click('button.switch')
      click('button.field-button')
      populateField('#field-test-repeater label:nth-last-of-type(2) input', 'Test Repeater Text')
      populateField('#field-test-repeater label:last-of-type input', 100)
      click('button.save-button')
    })

    it('displays component on the page', () => {
      cy.get('#single-use')
    })

  })

})


function populateField(selector, value) {
  cy.get(selector)
    .invoke('val', value)
    .type(' ')
}

function addField({ label, key, type = 'text', subfields }) {
  click('button#tab-fields')
  click('button.primary-button')
  cy.get('.field-item:last-of-type select').select(type)
  cy.get('.field-item:last-of-type input.label-input').type(label)
  cy.get('.field-item:last-of-type input.key-input').type(key)

  if (subfields) {
    subfields.forEach(({ label, key, type = 'text' }) => {
      click('button.subfield-button')
      cy.get('.field-item:last-of-type .field-container:last-of-type select').select(type)
      cy.get('.field-item:last-of-type .field-container:last-of-type .label-input').type(label)
      cy.get('.field-item:last-of-type .field-container:last-of-type .key-input').type(key)
    })
  }
}