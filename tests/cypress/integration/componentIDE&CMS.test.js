describe('Component IDE & CMS', () => {

    it('visit the page', () => {
        cy.visit('http://localhost:5174')
    })

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

    it("Modify component code IDE", () => {
        cy.wait(2000);
        cy.get('div.block-buttons-container').invoke('addClass', 'visible');
        cy.get('span').contains('Edit Code').click();
        cy.get('.codemirror-container:nth(1)').click()
        // TODO: change the line 152 which is color to yellowgreen
        
    });

    it('Modify component fields IDE', () => {
        cy.get('button#tab-fields').click();
        cy.get('#field-0 .input:nth(0)').clear()
        cy.get('#field-0 .input:nth(0)').type('Header');
        cy.wait(10000);
        cy.get('button').contains('Draft').click();
    });
    
    it('switch to IDE', () => {
        cy.get('#ide').click();
    })

    it("Edit component Content CMS", () => {
        cy.get('div.block-buttons-container').invoke('addClass', 'visible');
        cy.get('button.button-span').children('span').contains('Edit Content').click();
        cy.wait(5000);
        cy.get('input.input[type="text"]:nth(0)').clear().type('Frequently tested');
        cy.wait(10000);
        cy.get('button').contains('Draft').click();
    });
});

