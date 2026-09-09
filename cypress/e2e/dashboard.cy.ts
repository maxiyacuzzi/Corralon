import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseProducts, baseStockpiles, baseDeliveryNotes } from '../support/fixtures';

const LOW_STOCK_PRODUCT = {
  id: 'prod-3',
  name: 'Cal hidratada',
  bulk_unit: 'bolsa',
  retail_unit: 'kg',
  conversion_factor: 25,
  current_stock: 5,
  min_stock_alert: 10,
  price: 1200,
  category_id: null,
  supplier_id: null,
};

const MOVEMENT = {
  id: 'mov-1',
  product_id: 'prod-1',
  type: 'purchase_in',
  quantity: 250,
  reference_id: null,
  created_by: OWNER_PROFILE.id,
  created_at: '2026-01-05T00:00:00.000Z',
};

function saleThisMonth(id: string) {
  return {
    id,
    client_id: 'cli-1',
    delivery_note_id: null,
    total_amount: 1000,
    payment_method: 'cash',
    is_formal: false,
    discount_percent: 0,
    created_at: new Date().toISOString(),
  };
}

describe('Dashboard', () => {
  it('muestra las estadísticas generales', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      products: [...baseProducts(), LOW_STOCK_PRODUCT],
      stockpiles: baseStockpiles(),
      sales: [saleThisMonth('sale-1'), saleThisMonth('sale-2')],
      stock_movements: [MOVEMENT],
      delivery_notes: baseDeliveryNotes(),
    });
    cy.loginAs('/');

    cy.contains('h1', 'Dashboard').should('be.visible');
    cy.contains('.rounded-xl', 'Total de productos').should('contain', '3');
    cy.contains('.rounded-xl', 'Stock bajo').should('contain', '1');
    cy.contains('.rounded-xl', 'Acopios activos').should('contain', '1');
    cy.contains('.rounded-xl', 'Ventas del mes').should('contain', '2');
  });

  it('lista los últimos movimientos de stock y remitos generados', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      products: baseProducts(),
      stockpiles: [],
      sales: [],
      stock_movements: [MOVEMENT],
      delivery_notes: baseDeliveryNotes(),
    });
    cy.loginAs('/');

    cy.contains('.rounded-xl', 'Últimos movimientos de stock').within(() => {
      cy.contains('Cemento Loma Negra');
      cy.contains('Ingreso por compra');
    });
    cy.contains('.rounded-xl', 'Últimos remitos generados').within(() => {
      cy.contains('Remito N.º 000001');
    });
  });

  it('muestra el estado vacío cuando no hay datos cargados', () => {
    mockSupabase({
      profiles: [OWNER_PROFILE],
      products: [],
      stockpiles: [],
      sales: [],
      stock_movements: [],
      delivery_notes: [],
    });
    cy.loginAs('/');

    cy.contains('Sin movimientos registrados.').scrollIntoView().should('be.visible');
    cy.contains('Sin remitos generados.').scrollIntoView().should('be.visible');
  });
});
