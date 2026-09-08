import { mockSupabase, mockFunction } from '../support/mock-supabase';
import { OWNER_PROFILE, baseProducts } from '../support/fixtures';

const MOVEMENT = {
  id: 'mov-1',
  product_id: 'prod-1',
  type: 'purchase_in',
  quantity: 250,
  reference_id: null,
  created_by: OWNER_PROFILE.id,
  created_at: '2026-01-05T00:00:00.000Z',
};

describe('Stock', () => {
  it('lista el historial de movimientos', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], products: baseProducts(), stock_movements: [MOVEMENT] });
    cy.loginAs('/stock');

    cy.contains('h1', 'Stock').should('be.visible');
    cy.contains('tr', 'Cemento Loma Negra').within(() => {
      cy.contains('Ingreso por compra');
      cy.contains('+250 kg');
    });
  });

  it('filtra el historial de movimientos por producto', () => {
    const secondMovement = {
      id: 'mov-2',
      product_id: 'prod-2',
      type: 'adjustment',
      quantity: -5,
      reference_id: null,
      created_by: OWNER_PROFILE.id,
      created_at: '2026-01-06T00:00:00.000Z',
    };
    mockSupabase({ profiles: [OWNER_PROFILE], products: baseProducts(), stock_movements: [MOVEMENT, secondMovement] });
    cy.loginAs('/stock');

    cy.get('input[placeholder*="Buscar por producto"]').type('arena');
    cy.contains('tr', 'Arena gruesa').should('be.visible');
    cy.contains('tr', 'Cemento Loma Negra').should('not.exist');
  });

  it('registra un nuevo movimiento de stock vía la Edge Function', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], products: baseProducts(), stock_movements: [] });
    mockFunction('register-stock-movement', { statusCode: 200, body: { data: { ok: true } } });
    cy.loginAs('/stock');

    cy.contains('button', 'Registrar movimiento').click();
    cy.get('form').within(() => {
      cy.get('select').first().select('Cemento Loma Negra');
      cy.contains('label', 'Cantidad').next('input').type('40');
      cy.contains('button', 'Registrar movimiento').click();
    });

    cy.wait('@fn_register-stock-movement').its('request.body').should('deep.include', {
      product_id: 'prod-1',
      type: 'purchase_in',
    });
    cy.contains('h2', 'Nuevo movimiento de stock').should('not.exist');
  });

  it('muestra el error que devuelve la función si el movimiento no es válido', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], products: baseProducts(), stock_movements: [] });
    mockFunction('register-stock-movement', { statusCode: 200, body: { error: 'Stock insuficiente' } });
    cy.loginAs('/stock');

    cy.contains('button', 'Registrar movimiento').click();
    cy.get('form').within(() => {
      cy.contains('label', 'Cantidad').next('input').type('40');
      cy.contains('button', 'Registrar movimiento').click();
    });

    cy.contains('Stock insuficiente').should('be.visible');
  });

  it('deshabilita "Registrar movimiento" si todavía no hay productos cargados', () => {
    mockSupabase({ profiles: [OWNER_PROFILE], products: [], stock_movements: [] });
    cy.loginAs('/stock');

    cy.contains('button', 'Registrar movimiento').should('be.disabled');
  });
});
