import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseSuppliers } from '../support/fixtures';

describe('Proveedores', () => {
  it('lista los proveedores existentes', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], suppliers: baseSuppliers() });
    cy.loginAs('/proveedores');

    cy.contains('h1', 'Proveedores').should('be.visible');
    cy.contains('td', 'Loma Negra S.A.').should('be.visible');
    cy.contains('td', '30-12345678-9').should('be.visible');
  });

  it('crea un proveedor nuevo', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], suppliers: baseSuppliers() });
    cy.loginAs('/proveedores');

    cy.contains('button', 'Nuevo proveedor').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Nombre').next('input').type('Ferrum S.A.');
      cy.contains('label', 'CUIT').next('input').type('30-98765432-1');
      cy.contains('label', 'Teléfono').next('input').type('1144445555');
      cy.contains('button', 'Guardar proveedor').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('h2', 'Nuevo proveedor').should('not.exist');
    cy.contains('td', 'Ferrum S.A.').should('be.visible');
  });

  it('filtra proveedores por el buscador', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      suppliers: [
        ...baseSuppliers(),
        { id: 'sup-2', name: 'Ferrum S.A.', tax_id: '30-98765432-1', phone: '1144445555', created_at: '2026-01-01T00:00:00.000Z' },
      ],
    });
    cy.loginAs('/proveedores');

    cy.get('input[placeholder*="Buscar por nombre"]').type('ferrum');
    cy.contains('td', 'Ferrum S.A.').should('be.visible');
    cy.contains('td', 'Loma Negra S.A.').should('not.exist');
  });

  it('muestra un error si falla el guardado y no cierra el formulario', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], suppliers: baseSuppliers() });
    cy.loginAs('/proveedores');

    cy.intercept('POST', '**/rest/v1/suppliers*', { statusCode: 500, body: { message: 'unexpected error' } }).as(
      'insertSupplierFails'
    );

    cy.contains('button', 'Nuevo proveedor').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Nombre').next('input').type('Ferrum S.A.');
      cy.contains('button', 'Guardar proveedor').click();
    });

    cy.wait('@insertSupplierFails');
    cy.contains('No se pudo guardar el proveedor. Verificá tu conexión.').should('be.visible');
    cy.contains('h2', 'Nuevo proveedor').should('exist');
    cy.contains('td', 'Ferrum S.A.').should('not.exist');
  });
});
