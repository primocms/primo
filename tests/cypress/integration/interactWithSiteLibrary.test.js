//cypress test
describe('Interact with components in Primo Library and Site Library', () => {
    it('visit the page', () => {
    cy.visit('http://localhost:3000/demo')
  })
    it('Add component', () => {
        cy.get('.s-uvgTzu7uTdxL:nth-child(2) > .s-uvgTzu7uTdxL:nth-child(2)').click();
        cy.get ("button").contains("Primo Library").click();
        cy.get ("div > #component-xpflp").click();
        cy.get ("div > .buttons").get(".close").click();
    });

    it('Copy a component and paste it', () => {
        cy.get('.buttons > .s-uvgTzu7uTdxL:nth-child(2)').click();
        cy.get('header').children('.buttons ').children('.s-LPXYXXak1YWr:nth-child(2)').focus().click();
        cy.get('.xyz-in').children('.s-97TwSKxNpJop:nth-child(2)').click();

    });
    
    it('Delete a component', () => {
        cy.get('header:nth(2)').children('.buttons:nth-child(2)').children('.s-LPXYXXak1YWr:nth-child(1)').focus().click();
    });
    
    it('Rename component', () => {
        cy.get('header:nth(1)').children('.s-LPXYXXak1YWr').children('form').children('label').children('svg').click()
        cy.get('header:nth(1)').children('.s-LPXYXXak1YWr').children('form').children('label').children('input').clear().type('New Component').type("{enter}")
    });
    
    // it('Edit component', () => {
        //TODO: fix this test. currently it fails because of the modal does not open.
        // cy.get('header:nth(1)').children('.buttons:nth-child(2)').children('.s-LPXYXXak1YWr:nth-child(3)').click();

    // });
});
