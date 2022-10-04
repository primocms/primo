//cypress test
describe('Component Library', () => {
    it('visit the page', () => {
        cy.visit('http://localhost:5174')
    })
        
    it('Rename component', () => {
        cy.get('.col .component-label input').clear().type('New component name {enter}')
    });
    
    // it('Copy and paste a component', () => {
    //     cy.get('button[title="Copy Component"]').focus();
    //     cy.get('button[title="Copy Component"]').click();
    //     cy.get('button#paste-symbol').click();
    //     cy.get('.col:nth-of-type(2) .component-wrapper')
    // }); //it's not working for now

    it('Delete a component', () => {
        cy.get('.col:nth-of-type(1) button[title="Delete Component"]').click()
    });
});
