import { click, addField, createComponent } from '../../helpers'

context('Fields', () => {

  it('creates page and site fields', () => {
    cy.visit('http://cypress.localhost:5000')
    click('#fields')
    addField({
      label: 'First Test',
      key: 'first-test',
      value: 'Test Value'
    })
    addField({
      label: 'Second Test',
      key: 'second-test',
      type: 'number',
      value: 100
    })
    click('button.save-button')
  })

  it('uses page and site fields in single-use component', () => {
    createComponent({
      id: '',
      value: '{{ first-test }} - {{ second-test }}',
      fields: [{
        label: 'Overwrite Second Test',
        key: 'second-test',
        value: 200
      }]
    })
    click('button.save-button')
  })

  it('reflects fields in created component', () => {
    cy.get('.primo-component').contains('Test Value - 200')
  })

})
