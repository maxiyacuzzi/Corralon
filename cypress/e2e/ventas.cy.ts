import { mockSupabase, mockFunction } from '../support/mock-supabase';
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

const SALE_PAYMENT = {
  id: 'pay-1',
  sale_id: 'sale-1',
  method: 'cash',
  amount: 35000,
  discount_percent: 0,
  created_at: '2026-01-06T00:00:00.000Z',
};

function seedSales(opts: { sales?: unknown[]; salePayments?: unknown[]; deliveryNotes?: unknown[]; links?: unknown[] } = {}) {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    clients: baseClients(),
    products: baseProducts(),
    delivery_notes: opts.deliveryNotes ?? [],
    sale_delivery_notes: opts.links ?? [],
    sales: opts.sales ?? [],
    sale_payments: opts.salePayments ?? [],
  });
}

describe('Ventas', () => {
  it('lista las ventas con monto, forma de pago y comprobante', () => {
    seedSales({ sales: [SALE], salePayments: [SALE_PAYMENT] });
    cy.loginAs('/ventas');

    cy.contains('h1', 'Ventas').should('be.visible');
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('$35000.00');
      cy.contains('Efectivo: $35000.00');
      cy.contains('Informal');
    });
  });

  it('registra una venta nueva en efectivo vía la Edge Function', () => {
    seedSales();
    mockFunction('register-sale', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/ventas');

    cy.contains('button', 'Nueva venta').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Juan Pérez');
      cy.contains('label', 'Monto').next('input').type('10000');
      cy.contains('button', 'Registrar venta').click();
    });

    cy.wait('@fn_register-sale').its('request.body').should('deep.include', {
      client_id: 'cli-1',
      is_formal: false,
    });
    cy.contains('h2', 'Nueva venta').should('not.exist');
  });

  it('permite facturar un remito pendiente dentro de una venta', () => {
    seedSales({ deliveryNotes: baseDeliveryNotes() });
    mockFunction('register-sale', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/ventas');

    cy.contains('button', 'Nueva venta').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Juan Pérez');
      cy.contains('Remito N.º 000001').should('be.visible');
      cy.contains('Remito N.º 000001').parent().find('input[type="checkbox"]').check();
      cy.contains('label', 'Monto').next('input').type('35000');
      cy.contains('button', 'Registrar venta').click();
    });

    cy.wait('@fn_register-sale').its('request.body.delivery_note_ids').should('deep.equal', ['dn-1']);
  });

  it('no deja registrar una venta sin ningún monto cargado', () => {
    seedSales();
    cy.loginAs('/ventas');

    cy.contains('button', 'Nueva venta').click();
    cy.get('form').within(() => {
      // la línea de pago arranca sin monto -> total final $0.00, el botón queda deshabilitado
      cy.contains('Total: $0.00').should('be.visible');
      cy.contains('button', 'Registrar venta').should('be.disabled');
    });
  });

  it('muestra el error que devuelve la función si la venta no se puede registrar', () => {
    seedSales();
    mockFunction('register-sale', { statusCode: 200, body: { error: 'El remito ya fue facturado' } });
    cy.loginAs('/ventas');

    cy.contains('button', 'Nueva venta').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Juan Pérez');
      cy.contains('label', 'Monto').next('input').type('10000');
      cy.contains('button', 'Registrar venta').click();
    });

    cy.contains('El remito ya fue facturado').should('be.visible');
    cy.contains('h2', 'Nueva venta').should('exist');
  });
});
