import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseClients } from '../support/fixtures';

describe('Clientes', () => {
  it('lista los clientes con su cuenta corriente', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients() });
    cy.loginAs('/clientes');

    cy.contains('h1', 'Clientes').should('be.visible');
    cy.contains('tr', 'Constructora Sur SRL').within(() => {
      cy.contains('$15000.00');
    });
  });

  it('filtra clientes por nombre, CUIT o teléfono', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients() });
    cy.loginAs('/clientes');

    cy.get('input[placeholder*="Buscar por nombre"]').type('sur srl');
    cy.contains('td', 'Constructora Sur SRL').should('be.visible');
    cy.contains('td', 'Juan Pérez').should('not.exist');
  });

  it('crea un cliente nuevo', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients() });
    cy.loginAs('/clientes');

    cy.contains('button', 'Nuevo cliente').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Nombre').next('input').type('María López');
      cy.contains('button', 'Guardar cliente').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('h2', 'Nuevo cliente').should('not.exist');
    cy.contains('td', 'María López').should('be.visible');
  });

  it('muestra un error si falla el guardado y no cierra el formulario', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients() });
    cy.loginAs('/clientes');

    cy.intercept('POST', '**/rest/v1/clients*', { statusCode: 500, body: { message: 'unexpected error' } }).as(
      'insertClientFails'
    );

    cy.contains('button', 'Nuevo cliente').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Nombre').next('input').type('María López');
      cy.contains('button', 'Guardar cliente').click();
    });

    cy.wait('@insertClientFails');
    cy.contains('No se pudo guardar el cliente. Verificá tu conexión.').should('be.visible');
    cy.contains('h2', 'Nuevo cliente').should('exist');
  });
});
