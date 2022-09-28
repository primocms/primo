describe('Pages', () => {
    it('visit the page', () => {
        cy.visit('http://localhost:5174')
    })

    it('Create new top-level page by duplicating active page', () => {
        cy.get('#pages > .label').click();
        cy.get('.create-page').click();
        cy.get('#page-label > .input-container input').type('About Us');
        cy.get('#create-page').click();
    });

    it("Create new top-level page from scratch", () => {
        cy.get('.create-page').click();
        cy.get('#page-label input').type('Contact Us');
        cy.get('#duplicate input').click();
        cy.get('#create-page').click();
    });

    it("Rename top-level page", () => {
        cy.get('.page-items li:nth-child(2) button[title="Edit"]').click()
        cy.get('#page-label input').clear();
        cy.get('#page-label input').type('New title');
        cy.get('#page-url input').clear();
        cy.get('#page-url input').type('new-title');
        cy.get('#save-page').click();
    });

    it("Delete top-level page", () => {
        cy.get('.page-items li:nth-child(3) button[title="Delete page"]').click()
    });

    it("Create child page by duplicating active page", () => {
        cy.get('.page-items li:nth-child(2) button[title="Add sub-page"]').click()
        cy.get('#page-label input').type('contact');
        cy.get('#create-page').click();
    });

    it("Create child page from scratch", () => {
        cy.get('.create-page').click();
        cy.get('#page-label input').type('Child Page');
        cy.get('#duplicate input').click();
        cy.get('#create-page').click();
    });

    it("Rename child page", () => {
        cy.get('.page-items li:first-child button[title="Edit"]').click()
        cy.get('#page-label input').clear();
        cy.get('#page-label input').type('New child title');
        cy.get('#page-url input').clear();
        cy.get('#page-url input').type('new-child-title');
        cy.get('#save-page').click();
    });

    it("Delete child page", () => {
        cy.get('.page-items li:nth-child(2) button[title="Delete page"]').click()
    });
    
});


