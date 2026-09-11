import { mockSupabase } from '../support/mock-supabase';
import { OWNER_PROFILE, baseCategories, baseClients, baseProducts } from '../support/fixtures';

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

const MOVEMENT_CEMENTO = {
  id: 'mov-1',
  product_id: 'prod-1',
  type: 'sale_out',
  quantity: -50,
  reference_id: null,
  created_by: OWNER_PROFILE.id,
  created_at: isoDaysAgo(2),
};

const MOVEMENT_ARENA = {
  id: 'mov-2',
  product_id: 'prod-2',
  type: 'sale_out',
  quantity: -5,
  reference_id: null,
  created_by: OWNER_PROFILE.id,
  created_at: isoDaysAgo(2),
};

const SALE = {
  id: 'sale-1',
  client_id: 'cli-1',
  delivery_note_id: null,
  total_amount: 35000,
  payment_method: 'cash',
  is_formal: false,
  discount_percent: 0,
  created_at: isoDaysAgo(2),
};

function seedStats() {
  mockSupabase({
    profiles: [OWNER_PROFILE],
    products: baseProducts(),
    categories: baseCategories(),
    clients: baseClients(),
    sales: [SALE],
    stock_movements: [MOVEMENT_CEMENTO, MOVEMENT_ARENA],
  });
}

describe('Estadísticas', () => {
  it('muestra el ranking de productos más vendidos', () => {
    seedStats();
    cy.loginAs('/estadisticas');

    cy.contains('h1', 'Estadísticas').should('be.visible');
    cy.contains('tr', 'Cemento Loma Negra').within(() => {
      cy.contains('50 kg');
    });
  });

  it('muestra las ventas por categoría', () => {
    seedStats();
    cy.loginAs('/estadisticas');

    cy.contains('button', 'Ventas por categoría').click();
    cy.contains('tr', 'Cementos y morteros').should('be.visible');
    cy.contains('tr', 'Áridos').should('be.visible');
  });

  it('muestra el top de clientes por facturación', () => {
    seedStats();
    cy.loginAs('/estadisticas');

    cy.contains('button', 'Top clientes').click();
    cy.contains('tr', 'Juan Pérez').within(() => {
      cy.contains('$35.000,00');
    });
  });

  it('muestra la deuda de clientes', () => {
    seedStats();
    cy.loginAs('/estadisticas');

    cy.contains('button', 'Deuda de clientes').click();
    cy.contains('tr', 'Constructora Sur SRL').within(() => {
      cy.contains('$15.000,00');
    });
    cy.contains('tr', 'Juan Pérez').should('not.exist');
  });
});
