describe('Add new componets', () => {
    it('visit the page', () => {
        cy.visit('http://localhost:3000/demo')
    })
    it('switch to IDE', () => {
        cy.get('#ide').click();
    })
    it('Add new component', () => {
        cy.get('div > .has-options').children('div:nth-child(2)').children('div').children('button').children('.s-uvgTzu7uTdxL:nth(2)').click();
        cy.get('.library-buttons').children('button:nth-child(1)').click();
    })
    it('Add code to the new component', () => {
        cy.get('.s-BrJh17kzIpuo:nth(1)').click().type(`<p>
        Hello World </p>`, { parseSpecialCharSequences: false })
        cy.get('.s-26kNgjjIDjKx:nth(1)').click()
        cy.get('.cm-activeLine:nth(1)').type('p{color: red}', { parseSpecialCharSequences: false })
        cy.get('.s-26kNgjjIDjKx:nth(3)').click()
        // TODO: Add JS to the component
    })
    // it('Add fields', () => {

    // })
    // it('Draft the Component', () => {

    // })
})
