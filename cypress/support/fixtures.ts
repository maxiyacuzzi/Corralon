/** Datos base reutilizados entre specs para armar el seed de mockSupabase(). */

export interface TestProfile {
  id: string;
  name: string;
  role: 'owner' | 'salesperson' | 'warehouse';
  email: string;
}

export const OWNER_PROFILE: TestProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Dueño de prueba',
  role: 'owner',
  email: 'owner@test.com',
};

export function baseCategories() {
  return [
    { id: 'cat-1', name: 'Cementos y morteros', parent_id: null, created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'cat-2', name: 'Áridos', parent_id: null, created_at: '2026-01-01T00:00:00.000Z' },
  ];
}

export function baseSuppliers() {
  return [
    { id: 'sup-1', name: 'Loma Negra S.A.', tax_id: '30-12345678-9', phone: '1122334455', created_at: '2026-01-01T00:00:00.000Z' },
  ];
}

export function baseProducts() {
  return [
    {
      id: 'prod-1',
      name: 'Cemento Loma Negra',
      bulk_unit: 'bolsa',
      retail_unit: 'kg',
      conversion_factor: 25,
      current_stock: 500,
      min_stock_alert: 100,
      price: 3500,
      category_id: 'cat-1',
      supplier_id: 'sup-1',
    },
    {
      id: 'prod-2',
      name: 'Arena gruesa',
      bulk_unit: 'm3',
      retail_unit: 'm3',
      conversion_factor: 1,
      current_stock: 10,
      min_stock_alert: 2,
      price: 15000,
      category_id: 'cat-2',
      supplier_id: null,
    },
  ];
}

export function baseClients() {
  return [
    { id: 'cli-1', name: 'Juan Pérez', tax_id: '20-11111111-1', phone: '1155556666', account_balance: 0, created_at: '2026-01-01T00:00:00.000Z' },
    { id: 'cli-2', name: 'Constructora Sur SRL', tax_id: '30-22222222-2', phone: null, account_balance: 15000, created_at: '2026-01-01T00:00:00.000Z' },
  ];
}

export function baseStockpiles() {
  return [
    {
      id: 'stk-1',
      client_id: 'cli-1',
      product_id: 'prod-1',
      total_reserved: 100,
      total_withdrawn: 20,
      created_at: '2026-01-02T00:00:00.000Z',
    },
  ];
}

export function baseDeliveryNotes() {
  return [
    {
      id: 'dn-1',
      number: 1,
      client_id: 'cli-1',
      stockpile_id: null,
      items: [{ product_id: 'prod-1', quantity: 50 }],
      created_at: '2026-01-03T00:00:00.000Z',
    },
  ];
}
