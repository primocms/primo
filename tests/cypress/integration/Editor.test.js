//create cypress test for add component
describe("Interact with components in Primo Library and Site Library", () => {
    it("visit the page", () => {
        cy.visit("http://localhost:3000/demo");
    });

     it('switch to IDE', () => {
         cy.get('#ide').click();
        })
        
    it('Add component', () => {
        cy.get('span').contains('Add Component').click()
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

    it('Add content to the page', () => {
        cy.wait(2000);
        cy.get('div.block-buttons-container').invoke('addClass', 'visible');
        cy.get('span').contains('Add Section').click();
        cy.get('span').contains('Add Content').click()
        cy.get('p').type(`Hello Primo. This is a test.`);
    });

    it('Edt page content', () => {
        cy.get('div.block-buttons-container').invoke('addClass', 'visible');
        cy.get('div.ProseMirror').children('p').type('Hello CMS. This is a test.')
    });
    
    it('move block up/down', () => {
         cy.get('button.top-right:nth(1)').invoke('addClass', 'visible').click();
    });

    it('Delete Block/Component', () => {
        cy.wait(2000);
        cy.get('button.button-delete:nth(0)').invoke('addClass', 'visible').click();
    });

    it('Undo changes', () => {
        cy.get('button#undo').click();
        cy.get('button#undo').click();
    });

    it('Save Site', () => {
        cy.get('button#save').click();
    });
});