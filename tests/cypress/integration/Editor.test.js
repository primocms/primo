//create cypress test for add component
describe("Interact with components in Primo Library and Site Library", () => {
    it("visit the page", () => {
        cy.visit("http://localhost:5174");
    });

    // Update Component Content
    
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