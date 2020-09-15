import { click, navigateToPage, createPage, createComponent, addField } from '../../helpers'

const testComponent = `\
{{heading}}<br>\
{{#each people}}\
  {{name}} - {{age}}<br>\
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
          value: 'People'
        },
        {
          type: 'repeater',
          label: 'People',
          key: 'people',
          subfields: [
            {
              label: 'Name',
              key: 'name'
            },
            {
              label: 'Age',
              key: 'age'
            }
          ],
          value: [
            {
              name: 'John Doe',
              age: 55
            },
            {
              name: 'Jane Doe',
              age: 75
            }
          ]
        }
      ]
    })
    click('button.save-button')
  })

  it('displays component on the page', () => {
    cy.get('.primo-component').contains('People John Doe - 55 Jane Doe - 75')
  })

})

function populateField(selector, value) {
  cy.get(selector)
    .invoke('val', value)
    .type(' ')
}
