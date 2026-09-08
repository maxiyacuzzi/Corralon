import { mockSupabase, mockFunction } from '../support/mock-supabase';
import { OWNER_PROFILE, baseClients, baseProducts, baseStockpiles } from '../support/fixtures';

function seedStockpiles() {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    clients: baseClients(),
    products: baseProducts(),
    stockpiles: baseStockpiles(),
    stock_movements: [],
  });
}

describe('Acopios', () => {
  it('lista los acopios con su saldo restante', () => {
    seedStockpiles();
    cy.loginAs('/acopios');

    cy.contains('h1', 'Acopios').should('be.visible');
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('Cemento Loma Negra');
      // total_reserved 100, total_withdrawn 20 -> remaining 80 kg
      cy.contains('80 kg');
    });
  });

  it('filtra los acopios por cliente o producto', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      clients: baseClients(),
      products: baseProducts(),
      stockpiles: [
        ...baseStockpiles(),
        { id: 'stk-2', client_id: 'cli-2', product_id: 'prod-2', total_reserved: 3, total_withdrawn: 0, created_at: '2026-01-02T00:00:00.000Z' },
      ],
      stock_movements: [],
    });
    cy.loginAs('/acopios');

    cy.get('input[placeholder*="Buscar por cliente"]').type('sur');
    cy.contains('tr', 'Constructora Sur SRL').should('be.visible');
    cy.contains('tr', 'Juan Pérez').should('not.exist');
  });

  it('crea un acopio nuevo para un cliente', () => {
    seedStockpiles();
    cy.loginAs('/acopios');

    cy.contains('button', 'Nuevo acopio').click();
    cy.get('form').within(() => {
      cy.get('select').eq(0).select('Constructora Sur SRL');
      cy.get('select').eq(1).select('Arena gruesa');
      cy.contains('label', 'Cantidad reservada').next('input').type('5');
      cy.contains('button', 'Crear acopio').click();
    });

    cy.wait('@supabaseRest');
    cy.contains('h2', 'Nuevo acopio').should('not.exist');
    cy.contains('tr', 'Constructora Sur SRL').should('be.visible');
  });

  it('retira contra un acopio vía la Edge Function', () => {
    seedStockpiles();
    mockFunction('withdraw-stockpile', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/acopios');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Retirar').click();
    });

    cy.contains('h2', /Retirar de acopio/).should('exist');
    cy.contains('label', 'Cantidad a retirar').next('input').type('1');
    cy.contains('button', 'Confirmar retiro').click();

    cy.wait('@fn_withdraw-stockpile').its('request.body').should('deep.include', { stockpile_id: 'stk-1' });
    cy.contains('h2', /Retirar de acopio/).should('not.exist');
  });

  it('muestra un error si falla la creación de un acopio', () => {
    seedStockpiles();
    cy.loginAs('/acopios');

    cy.intercept('POST', '**/rest/v1/stockpiles*', { statusCode: 500, body: { message: 'unexpected error' } }).as(
      'insertStockpileFails'
    );

    cy.contains('button', 'Nuevo acopio').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Cantidad reservada').next('input').type('5');
      cy.contains('button', 'Crear acopio').click();
    });

    cy.wait('@insertStockpileFails');
    cy.contains('No se pudo crear el acopio. Verificá tu conexión.').should('be.visible');
    cy.contains('h2', 'Nuevo acopio').should('exist');
  });

  it('no deja retirar más cantidad de la que queda disponible', () => {
    seedStockpiles();
    cy.loginAs('/acopios');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Retirar').click();
    });

    // saldo disponible: 80 kg. La unidad de carga por defecto es "bolsa" (25 kg c/u),
    // así que pedir 10 bolsas equivale a 250 kg y supera el saldo.
    cy.contains('label', 'Cantidad a retirar').next('input').type('10');
    cy.contains('Supera el saldo disponible.').should('be.visible');
    cy.contains('button', 'Confirmar retiro').should('be.disabled');
  });

  it('muestra el error que devuelve la función si el retiro no es válido', () => {
    seedStockpiles();
    mockFunction('withdraw-stockpile', { statusCode: 200, body: { error: 'El acopio ya no tiene saldo disponible' } });
    cy.loginAs('/acopios');

    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('button', 'Retirar').click();
    });
    cy.contains('label', 'Cantidad a retirar').next('input').type('1');
    cy.contains('button', 'Confirmar retiro').click();

    cy.contains('El acopio ya no tiene saldo disponible').should('be.visible');
    cy.contains('h2', /Retirar de acopio/).should('exist');
  });
});
