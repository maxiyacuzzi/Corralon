import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseClients } from '../support/fixtures';

const CHECK_IN_WALLET = {
  id: 'chk-1',
  client_id: 'cli-1',
  sale_id: null,
  check_number: '00012345',
  bank: 'Banco Galicia',
  amount: 50000,
  holder_name: 'Materiales del Norte SA',
  holder_tax_id: '30-33333333-3',
  emission_date: '2025-12-28',
  issue_date: '2026-01-01',
  due_date: '2026-01-20',
  is_deferred: false,
  status: 'in_wallet',
  notes: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('Valores', () => {
  it('lista los cheques con su estado', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [CHECK_IN_WALLET] });
    cy.loginAs('/valores');

    cy.contains('h1', 'Valores').should('be.visible');
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('Banco Galicia');
      cy.contains('00012345');
      cy.contains('Materiales del Norte SA');
      cy.contains('CUIT 30-33333333-3');
      cy.contains('28/12/2025');
      cy.contains('En cartera');
    });
  });

  it('filtra cheques por cliente, banco o número', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [CHECK_IN_WALLET] });
    cy.loginAs('/valores');

    cy.get('input[placeholder*="Buscar por cliente"]').type('no existe ningún cheque así');
    cy.contains('Ningún cheque coincide con la búsqueda.').should('be.visible');
  });

  it('carga un cheque nuevo', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [] });
    cy.loginAs('/valores');

    cy.contains('button', 'Nuevo cheque').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Banco').next('input').type('Banco Nación');
      cy.contains('label', 'N.º de cheque').next('input').type('00098765');
      cy.contains('label', 'Titular del cheque').next('input').type('Juan Pérez');
      cy.contains('label', 'CUIT del titular').next('input').type('20-11111111-1');
      cy.contains('label', 'Fecha de emisión').next('input').type('2026-01-15');
      cy.contains('label', 'Monto').next('input').type('20000');
      cy.contains('label', 'Fecha de cobro').next('input').type('2026-03-01');
      cy.contains('button', 'Guardar cheque').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('h2', 'Nuevo cheque').should('not.exist');
    cy.contains('td', 'Banco Nación').should('be.visible');
  });

  it('avanza el estado de un cheque de En cartera a Depositado', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [CHECK_IN_WALLET] });
    cy.loginAs('/valores');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Depositar').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('Depositado');
    });
  });

  it('al cargar un cheque muestra la cuenta corriente del cliente antes y después', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [] });
    cy.loginAs('/valores');

    cy.contains('button', 'Nuevo cheque').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Constructora Sur SRL');
      cy.contains('Cuenta corriente actual:').should('contain', 'debe $15.000,00');
      cy.contains('label', 'Monto').next('input').type('20000');
      cy.contains('después del cheque').parent().should('contain', 'saldo a favor $5.000,00');
    });
  });

  it('muestra un error si falla el guardado y no cierra el formulario', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], clients: baseClients(), checks: [] });
    cy.loginAs('/valores');

    cy.intercept('POST', '**/rest/v1/checks*', { statusCode: 500, body: { message: 'unexpected error' } }).as(
      'insertCheckFails'
    );

    cy.contains('button', 'Nuevo cheque').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Banco').next('input').type('Banco Nación');
      cy.contains('label', 'N.º de cheque').next('input').type('00098765');
      cy.contains('label', 'Titular del cheque').next('input').type('Juan Pérez');
      cy.contains('label', 'CUIT del titular').next('input').type('20-11111111-1');
      cy.contains('label', 'Fecha de emisión').next('input').type('2026-01-15');
      cy.contains('label', 'Monto').next('input').type('20000');
      cy.contains('label', 'Fecha de cobro').next('input').type('2026-03-01');
      cy.contains('button', 'Guardar cheque').click();
    });

    cy.wait('@insertCheckFails');
    cy.contains('No se pudo guardar el cheque. Verificá tu conexión.').should('be.visible');
    cy.contains('h2', 'Nuevo cheque').should('exist');
  });
});
