
//create cypress test for add component
describe('Interact with components in Primo Library and Site Library', () => {
    it('visit the page', () => {
    cy.visit('http://localhost:5174')
    })
    
    it('switch to IDE', () => {
        cy.get('#ide').click();
    })
    
    it('Add component', () => {
        cy.get('span.label').contains('Components').click();
        cy.get ("button").contains("Primo Library").click();
        cy.get ("div#component-zjuqm").click();
        cy.get ("div.buttons").get(`[aria-label="Close modal"]`).click();
    });

    it("Check if the added componet exist", () => {
        cy.get('span').contains('Add Component').click()
        cy.get ("button").contains("Site Library").click();
        cy.get ("div.component-wrapper").should('exist');
        cy.get ("div.component-wrapper").click();
    });


    it('create new component', () => {
        cy.get('span.label').contains('Components').click();
        cy.get('button#create-symbol').click();
        cy.get('.s-BrJh17kzIpuo:nth(1)').click().type(`<p>
        Hello World`, { parseSpecialCharSequences: false })
        cy.get('.s-26kNgjjIDjKx:nth(1)').click()
        cy.get('.cm-activeLine:nth(1)').type('p{color: red}', { parseSpecialCharSequences: false })
        cy.get('.s-26kNgjjIDjKx:nth(3)').click()
        // TODO: Add JS to the component
        cy.wait(15000);
        cy.get('button').contains('Draft').click();
    });

    //  it('Add fields', () => {

    // })

    //  it('Add content', () => {

    // })

    it('Open component code', () => {
        cy.get('button[title="Edit Component"]:nth(1)').click(); // the open is not working in Cypress
    });
});
