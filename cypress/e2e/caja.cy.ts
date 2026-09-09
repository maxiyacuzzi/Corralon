import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE } from '../support/fixtures';

const CASH_PAYMENT = {
  id: 'pay-1',
  sale_id: 'sale-1',
  method: 'cash',
  amount: 10000,
  discount_percent: 0,
  created_at: new Date().toISOString(),
};

const TRANSFER_PAYMENT = {
  id: 'pay-2',
  sale_id: 'sale-1',
  method: 'transfer',
  amount: 5000,
  discount_percent: 0,
  created_at: new Date().toISOString(),
};

const SALE = {
  id: 'sale-1',
  client_id: 'cli-1',
  delivery_note_id: null,
  total_amount: 15000,
  payment_method: 'mixed',
  is_formal: false,
  discount_percent: 0,
  created_at: new Date().toISOString(),
};

const CLIENT = {
  id: 'cli-1',
  name: 'Juan Pérez',
  tax_id: null,
  phone: null,
  account_balance: 0,
  created_at: '2026-01-01T00:00:00.000Z',
};

function seedCaja(closings: unknown[] = []) {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    sales: [SALE],
    sale_payments: [CASH_PAYMENT, TRANSFER_PAYMENT],
    clients: [CLIENT],
    cash_closings: closings,
  });
}

describe('Caja', () => {
  it('muestra los totales de ingresos del período', () => {
    seedCaja();
    cy.loginAs('/caja');

    cy.contains('h1', 'Caja').should('be.visible');
    cy.contains('Ingresos de hoy').parents('.rounded-xl').first().should('contain', '$15.000,00');
  });

  it('registra un cierre de caja y calcula el sobrante', () => {
    seedCaja();
    cy.loginAs('/caja');

    cy.contains('button', 'Nuevo cierre').click();
    cy.contains('Efectivo esperado').parents('.rounded-lg').first().should('contain', '$10.000,00');

    cy.get('input[type="number"]').type('10500');
    cy.contains('Sobran $500,00').should('be.visible');

    cy.contains('button', 'Cerrar caja').click();

    cy.wait('@supabaseRest').its('request.body').should('deep.include', {
      expected_cash: 10000,
      counted_cash: 10500,
      transfer_total: 5000,
    });
    cy.contains('h3', 'Nuevo cierre').should('not.exist');
    cy.contains('$10.500,00').should('be.visible');
  });

  it('muestra el historial de cierres previos con la diferencia', () => {
    seedCaja([
      {
        id: 'close-1',
        period_start: null,
        period_end: '2026-01-05T20:00:00.000Z',
        expected_cash: 10000,
        counted_cash: 9800,
        difference: -200,
        transfer_total: 5000,
        checks_total: 0,
        notes: null,
        created_by: OWNER_PROFILE.id,
        created_at: '2026-01-05T20:00:00.000Z',
      },
    ]);
    cy.loginAs('/caja');

    cy.contains('Desde el inicio').should('be.visible');
    cy.contains('-$200,00').should('be.visible');
    cy.contains('Dueño de prueba').should('be.visible');
  });
});
