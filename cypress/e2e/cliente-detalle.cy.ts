import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseClients, baseProducts, baseDeliveryNotes } from '../support/fixtures';

const SALE = {
  id: 'sale-1',
  client_id: 'cli-1',
  delivery_note_id: null,
  total_amount: 35000,
  payment_method: 'cash',
  is_formal: false,
  discount_percent: 0,
  created_at: '2026-01-06T00:00:00.000Z',
};

function seedClientDetail(opts: { sales?: unknown[]; deliveryNotes?: unknown[] } = {}) {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    clients: baseClients(),
    products: baseProducts(),
    delivery_notes: opts.deliveryNotes ?? baseDeliveryNotes(),
    sales: opts.sales ?? [SALE],
    sale_delivery_notes: [],
    sale_payments: [],
  });
}

describe('Detalle de cliente', () => {
  it('muestra los datos del cliente, sus remitos y sus ventas', () => {
    seedClientDetail();
    cy.loginAs('/clientes/cli-1');

    cy.contains('h1', 'Juan Pérez').should('be.visible');
    cy.contains('CUIT/DNI: 20-11111111-1').should('be.visible');

    cy.contains('.rounded-xl', 'Remitos').within(() => {
      cy.contains('000001');
      cy.contains('Pendiente');
    });
    cy.contains('.rounded-xl', 'Ventas').within(() => {
      cy.contains('$35000.00');
      cy.contains('Informal');
    });
  });

  it('muestra el estado vacío cuando el cliente no tiene remitos ni ventas', () => {
    seedClientDetail({ sales: [], deliveryNotes: [] });
    cy.loginAs('/clientes/cli-1');

    cy.contains('Sin remitos registrados.').should('be.visible');
    cy.contains('Sin ventas registradas.').should('be.visible');
  });

  it('avisa cuando el cliente no existe', () => {
    seedClientDetail();
    cy.loginAs('/clientes/no-existe');

    cy.contains('Cliente no encontrado.').should('be.visible');
    cy.contains('← Volver a clientes').should('be.visible');
  });

  it('abre la vista previa de un remito desde el historial del cliente', () => {
    seedClientDetail();
    cy.loginAs('/clientes/cli-1');

    cy.contains('.rounded-xl', 'Remitos').within(() => {
      cy.contains('button', 'Ver remito').click();
    });

    cy.contains('← Volver al historial').should('be.visible');
    cy.contains('Cemento Loma Negra').should('be.visible');
  });
});
