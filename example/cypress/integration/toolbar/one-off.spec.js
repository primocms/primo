import { click, navigateToPage, createPage, createComponent, addField } from '../../helpers'

const testComponent = `\
{{heading}}<br>\
{{#each test-repeater}}\
  {{test-text}} & {{test-number}}\
{{/each}}\
`

context('Components', () => {

  it('creates a component', () => {
    cy.visit('http://cypress.localhost:5000')
    createComponent({
      id: 'single-use',
      value: testComponent,
      fields: [
        {
          label: 'Heading',
          key: 'heading',
          value: 'Test heading'
        },
        {
          type: 'repeater',
          label: 'Test Repeater',
          key: 'test-repeater',
          subfields: [
            {
              label: 'Repeater Text',
              key: 'test-text',
              value: 'Test Repeater Text'
            },
            {
              label: 'Repeater Number',
              key: 'test-number',
              vaue: 100
            }
          ]
        }
      ]
    })
    click('button.save-button')
  })

  it('displays component on the page', () => {
    cy.get('#single-use')
  })

})

function populateField(selector, value) {
  cy.get(selector)
    .invoke('val', value)
    .type(' ')
}
