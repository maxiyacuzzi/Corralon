import { mockSupabase, mockFunction } from '../support/mock-supabase';
import { OWNER_PROFILE, baseClients, baseProducts, baseStockpiles, baseDeliveryNotes } from '../support/fixtures';

function seedDeliveryNotes(opts: { linked?: boolean } = {}) {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    clients: baseClients(),
    products: baseProducts(),
    stockpiles: baseStockpiles(),
    delivery_notes: baseDeliveryNotes(),
    sale_delivery_notes: opts.linked ? [{ sale_id: 'sale-1', delivery_note_id: 'dn-1' }] : [],
  });
}

describe('Remitos', () => {
  it('lista los remitos con su número y estado de facturación', () => {
    seedDeliveryNotes();
    cy.loginAs('/remitos');

    cy.contains('h1', 'Remitos').should('be.visible');
    cy.contains('tr', '000001').within(() => {
      cy.contains('Juan Pérez');
      cy.contains('Pendiente');
    });
  });

  it('marca como Facturado un remito ya vinculado a una venta', () => {
    seedDeliveryNotes({ linked: true });
    cy.loginAs('/remitos');

    cy.contains('tr', '000001').within(() => {
      cy.contains('Facturado');
    });
  });

  it('filtra remitos por cliente', () => {
    seedDeliveryNotes();
    cy.loginAs('/remitos');

    cy.get('input[placeholder*="Buscar por cliente"]').type('constructora');
    cy.contains('No hay remitos generados todavía.').should('not.exist');
    cy.contains('Ningún remito coincide con la búsqueda.').should('be.visible');
  });

  it('genera un remito nuevo vía la Edge Function', () => {
    seedDeliveryNotes();
    mockFunction('generate-delivery-note', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/remitos');

    cy.contains('button', 'Nuevo remito').click();
    cy.get('form').within(() => {
      cy.get('select').eq(0).select('Juan Pérez');
      cy.contains('button', 'Generar remito').click();
    });

    cy.wait('@fn_generate-delivery-note').its('request.body').should('deep.include', { client_id: 'cli-1' });
    cy.contains('h2', 'Nuevo remito').should('not.exist');
  });

  it('abre la vista previa de un remito', () => {
    seedDeliveryNotes();
    cy.loginAs('/remitos');

    cy.contains('tr', '000001').within(() => {
      cy.contains('button', 'Ver remito').click();
    });

    cy.contains('← Volver al listado').should('be.visible');
    cy.contains('Cemento Loma Negra').should('be.visible');
  });

  it('muestra el error que devuelve la función si el remito no se puede generar', () => {
    seedDeliveryNotes();
    mockFunction('generate-delivery-note', { statusCode: 200, body: { error: 'No hay stock suficiente' } });
    cy.loginAs('/remitos');

    cy.contains('button', 'Nuevo remito').click();
    cy.get('form').within(() => {
      cy.get('select').eq(0).select('Juan Pérez');
      cy.contains('button', 'Generar remito').click();
    });

    cy.contains('No hay stock suficiente').should('be.visible');
    cy.contains('h2', 'Nuevo remito').should('exist');
  });

  it('muestra un mensaje genérico si la Edge Function falla por conexión', () => {
    seedDeliveryNotes();
    cy.intercept('POST', '**/functions/v1/generate-delivery-note', { forceNetworkError: true }).as(
      'generateDeliveryNoteNetworkError'
    );
    cy.loginAs('/remitos');

    cy.contains('button', 'Nuevo remito').click();
    cy.get('form').within(() => {
      cy.get('select').eq(0).select('Juan Pérez');
      cy.contains('button', 'Generar remito').click();
    });

    cy.wait('@generateDeliveryNoteNetworkError');
    cy.contains('Error de conexión. Intentá nuevamente.').should('be.visible');
  });
});
