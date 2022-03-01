describe('Publish from Editor', () => {

    it('visit the page', () => {
        cy.visit('http://localhost:3000/demo')
    })

    it('Add component', () => {
        cy.get('span').contains('Add Component').click()
        cy.get ("button").contains("Primo Library").click();
        cy.get ("div#component-xpflp").click();
        cy.get ("div.buttons").get(`[aria-label="Close modal"]`).click();
    });
    
    it("Check if the added componet exist", () => {
        cy.get('span').contains('Add Component').click()
        cy.get ("button").contains("Site Library").click();
        cy.get ("div.component-wrapper").should('exist');
        cy.get ("div.component-wrapper").click();
    });

    it('Connect Netlify', () => {
        
    });

    it("Connect Vercel", () => {
        
    });

    it("Disconnect host", () => {
        
    });

    it("Download site", () => {
        cy.get('span').contains('Publish').click()
        cy.get('button[type="button"]').contains('Download your site').click()
    });

    it("Save and publish", () => {
        
    });
});


