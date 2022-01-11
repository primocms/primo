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

    it('Copy component and paste it', () => {
        cy.get('.buttons > .s-uvgTzu7uTdxL:nth-child(2)').click();
        cy.get('header').children('.buttons ').children('.s-LPXYXXak1YWr:nth-child(2)').focus().click();
        cy.get('.xyz-in').children('.s-97TwSKxNpJop:nth-child(2)').click();

    });
    
    // it('Rename component', () => {

    // });
    // it('Delete component', () => {

    // });
    // it('Edit component', () => {
    // });
});
