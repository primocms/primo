//cypress test
describe('Component Library', () => {
    it('visit the page', () => {
    cy.visit('http://localhost:3000/demo')
  })
    it('Adds a new Site Library component from the Primo Library', () => {
        cy.get('.primo-section .buttons button:last-child').click();
        cy.get("button").contains("Primo Library").click();
        cy.get("#component-xpflp button").click({ force: true }); // component loading hides button
        cy.get('button#site-library').click()
        cy.get(".component-wrapper")
        // cy.get(".masonry .col:first-child .component-wrapper:first-child button.primary-action").click();
    });

    it('Copy and paste a component', () => {
        cy.get('button[title="Copy Component"]').focus();
        cy.get('button[title="Copy Component"]').click();
        cy.get('button#paste-symbol').click();
        cy.get('.col:nth-of-type(2) .component-wrapper')
    });
    
    it('Delete a component', () => {
        cy.get('.col:nth-of-type(2) button[title="Delete Component"]').click()
    });
    
    it('Rename component', () => {
        cy.get('.col .component-label input').clear().type('New component name {enter}')
    });
    
});
