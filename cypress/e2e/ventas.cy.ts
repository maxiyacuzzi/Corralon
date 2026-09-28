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
      cy.contains('$35.000,00');
      cy.contains('Efectivo: $35.000,00');
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
      cy.contains('label', 'Monto').next('input').clear().type('35000');
      cy.contains('button', 'Registrar venta').click();
    });

    cy.wait('@fn_register-sale').its('request.body.delivery_note_ids').should('deep.equal', ['dn-1']);
  });

  it('permite agregar productos directo en la venta, sin remito', () => {
    seedSales();
    mockFunction('register-sale', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/ventas');

    cy.contains('button', 'Nueva venta').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Juan Pérez');
      cy.contains('button', '+ Agregar producto').click();
      cy.contains('Total de productos:').should('contain', '$3.500,00');
      cy.contains('label', 'Monto').next('input').should('have.value', '3500');
      cy.contains('button', 'Registrar venta').click();
    });

    cy.wait('@fn_register-sale')
      .its('request.body.items')
      .should('deep.equal', [{ product_id: 'prod-1', quantity: 1, unit_price: 3500 }]);
  });

  it('muestra la cuenta corriente actual del cliente elegido', () => {
    seedSales();
    cy.loginAs('/ventas');

    cy.contains('button', 'Nueva venta').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Constructora Sur SRL');
      cy.contains('Cuenta corriente actual:').should('contain', 'debe $15.000,00');
      cy.get('select').first().select('Juan Pérez');
      cy.contains('Cuenta corriente actual:').should('contain', 'al día');
    });
  });

  it('si el cliente entrega menos, el saldo queda debiendo en su cuenta corriente', () => {
    seedSales();
    mockFunction('register-sale', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/ventas');

    cy.contains('button', 'Nueva venta').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Juan Pérez');
      cy.contains('button', '+ Agregar producto').click();
      cy.contains('label', 'Monto').next('input').clear().type('2000');
      cy.contains('Queda debiendo $1.500,00').should('be.visible');
      cy.contains('Cuenta corriente después de la venta:').should('contain', 'debe $1.500,00');
      cy.contains('button', 'Registrar venta').click();
    });

    cy.wait('@fn_register-sale')
      .its('request.body.payments.0')
      .should('deep.include', { method: 'cash', amount: 2000, covered_amount: 2000 });
  });

  it('si el cliente entrega de más, le queda saldo a favor', () => {
    seedSales();
    cy.loginAs('/ventas');

    cy.contains('button', 'Nueva venta').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Juan Pérez');
      cy.contains('button', '+ Agregar producto').click();
      cy.contains('label', 'Monto').next('input').clear().type('4000');
      cy.contains('queda $500,00 a favor del cliente').should('be.visible');
      cy.contains('Cuenta corriente después de la venta:').should('contain', 'saldo a favor $500,00');
    });
  });

  it('envía titular, CUIT y fecha de emisión del cheque al pagar con Valores', () => {
    seedSales();
    mockFunction('register-sale', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/ventas');

    cy.contains('button', 'Nueva venta').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Juan Pérez');
      cy.contains('button', '+ Agregar producto').click();
      cy.contains('label', 'Formas de pago').parent().find('select').first().select('Valores');
      cy.get('input[placeholder="Banco"]').type('Banco Nación');
      cy.get('input[placeholder="N.º de cheque"]').type('00055555');
      cy.get('input[placeholder="Titular del cheque"]').type('Materiales del Norte SA');
      cy.get('input[placeholder="CUIT del titular"]').type('30-33333333-3');
      cy.contains('label', 'Fecha de emisión').next('input').type('2026-09-20');
      cy.contains('label', 'Fecha de cobro').next('input').type('2026-10-20');
      cy.contains('button', 'Registrar venta').click();
    });

    cy.wait('@fn_register-sale').its('request.body.payments.0.check').should('deep.include', {
      holder_name: 'Materiales del Norte SA',
      holder_tax_id: '30-33333333-3',
      emission_date: '2026-09-20',
    });
  });

  it('no deja registrar una venta sin ningún monto cargado', () => {
    seedSales();
    cy.loginAs('/ventas');

    cy.contains('button', 'Nueva venta').click();
    cy.get('form').within(() => {
      // la línea de pago arranca sin monto -> total final $0,00, el botón queda deshabilitado
      cy.contains('Total cobrado: $0,00').scrollIntoView().should('be.visible');
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
