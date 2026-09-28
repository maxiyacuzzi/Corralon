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

// Cheque cargado suelto desde Valores (cobro a cuenta, sin venta).
const ACCOUNT_CHECK = {
  id: 'chk-1',
  client_id: 'cli-1',
  sale_id: null,
  check_number: '00012345',
  bank: 'Banco Galicia',
  amount: 20000,
  issue_date: '2026-01-01',
  due_date: '2026-01-20',
  is_deferred: false,
  status: 'in_wallet',
  notes: null,
  created_at: new Date().toISOString(),
};

// Cheque que vino de una venta: ya está contado en sale_payments, no se suma dos veces.
const SALE_CHECK = { ...ACCOUNT_CHECK, id: 'chk-2', sale_id: 'sale-1', amount: 99999 };

function seedCaja(closings: unknown[] = [], checks: unknown[] = []) {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    sales: [SALE],
    sale_payments: [CASH_PAYMENT, TRANSFER_PAYMENT],
    clients: [CLIENT],
    cash_closings: closings,
    checks,
  });
}

describe('Caja', () => {
  it('muestra los totales de ingresos del período', () => {
    seedCaja();
    cy.loginAs('/caja');

    cy.contains('h1', 'Caja').should('be.visible');
    cy.contains('Ingresos de hoy').parents('.rounded-xl').first().should('contain', '$15.000,00');
  });

  it('suma a la caja los cheques cargados sueltos como cobro a cuenta', () => {
    seedCaja([], [ACCOUNT_CHECK, SALE_CHECK]);
    cy.loginAs('/caja');

    cy.contains('Ingresos de hoy').parents('.rounded-xl').first().should('contain', '$35.000,00');
    cy.contains('tr', 'Cobro a cuenta').should('contain', '$20.000,00').and('contain', 'Valores');

    cy.contains('button', 'Nuevo cierre').click();
    cy.contains('Cheques del período').parents('.rounded-lg').first().should('contain', '$20.000,00');
  });

  it('registra un cierre de caja y calcula el sobrante', () => {
    seedCaja();
    cy.intercept('POST', '**/rest/v1/cash_closings*').as('insertClosing');
    cy.loginAs('/caja');

    cy.contains('button', 'Nuevo cierre').click();
    cy.contains('Efectivo esperado').parents('.rounded-lg').first().should('contain', '$10.000,00');

    cy.get('input[type="number"]').type('10500');
    cy.contains('Sobran $500,00').should('be.visible');

    cy.contains('button', 'Cerrar caja').click();

    cy.wait('@insertClosing').its('request.body').should('deep.include', {
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
