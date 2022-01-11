describe('Interact with pages', () => {
    it('visit the page', () => {
    cy.visit('http://localhost:3000/demo')
  })
    it('Add new page by duplicate the current page', () => {
        cy.get('#pages > .label').click();
        cy.get('.create-page').click();
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').type('About Us');
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').click();
        cy.get('#create-page').click();
    });

    it("Add new page without duplicate the current page", () => {
        cy.get('.create-page').click();
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').type('Contact Us');
        cy.get('#duplicate > .s-e5zkEAO88g53 > .s-e5zkEAO88g53:nth-child(1)').click();
        cy.get('#create-page').click();
    });
    it("Rename a page", () => {
        cy.get('.xyz-in:nth-child(2) .s-AwucMQwSCmjX:nth-child(1) > .fas').click();
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').click();
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').clear();
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').type('About them');
        cy.get('.input-container > .s-0-niEE6zcxdJ:nth-child(2)').click();
        cy.get('.input-container > .s-0-niEE6zcxdJ:nth-child(2)').clear();
        cy.get('.input-container > .s-0-niEE6zcxdJ:nth-child(2)').type('about-them');
        cy.get('#save-page').click();
        
    });
    it("Delete a page", () => {
        cy.get('.xyz-in:nth-child(3) .s-AwucMQwSCmjX:nth-child(3) > .fa-trash').click();
    });
    it("Add sub page by duplicate the current page", () => {
        cy.get('.xyz-in:nth-child(2) .s-AwucMQwSCmjX:nth-child(2) > .fas').click();
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').click();
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').type('contact');
        cy.get('#create-page').click();
        
    });
    it("Add sub page without duplicate the current page", () => {
        cy.get('.create-page').click();
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').type('call Us');
        cy.get('#duplicate > .s-e5zkEAO88g53 > .s-e5zkEAO88g53:nth-child(1)').click();
        cy.get('#create-page').click();

    });
    it("Rename sub page", () => {
        cy.get('.xyz-in:nth-child(2) .s-AwucMQwSCmjX:nth-child(2) > .fas').click();
        cy.get('.xyz-in:nth-child(1) .s-AwucMQwSCmjX:nth-child(1) > .fas').click();
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').clear();
        cy.get('#page-label > .input-container > .s-0-niEE6zcxdJ').type('contact us');
        cy.get('.input-container > .s-0-niEE6zcxdJ:nth-child(2)').click();
        cy.get('.input-container > .s-0-niEE6zcxdJ:nth-child(2)').clear();
        cy.get('.input-container > .s-0-niEE6zcxdJ:nth-child(2)').type('about-them/contact-us');
        cy.get('#save-page').click();
    });
    it("Delete sub page", () => {
        cy.get('.xyz-in:nth-child(2) .s-AwucMQwSCmjX:nth-child(2) > .fas').click();
    });
    
});


