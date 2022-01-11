//create cypress test for add component
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

    it("Check if the added componet exist", () => {
        cy.get('.s-uvgTzu7uTdxL:nth-child(2) > .s-uvgTzu7uTdxL:nth-child(2)').click();
        cy.get ("button").contains("Site Library").click();
        cy.get ("div > .component-wrapper").should('exist');
        cy.get ("div > .component-wrapper").click();
    });

});
