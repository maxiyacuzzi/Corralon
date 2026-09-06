export type UserRole = 'owner' | 'salesperson' | 'warehouse';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  bulk_unit: string; // ej: 'm3', 'ton', 'bolsa'
  retail_unit: string; // ej: 'kg', 'unidad'
  conversion_factor: number; // cuántas retail_unit hay por 1 bulk_unit
  current_stock: number; // en retail_unit
  min_stock_alert: number;
  price: number;
}

export interface StockMovement {
  id: string;
  product_id: string;
  type: 'purchase_in' | 'sale_out' | 'stockpile_out' | 'adjustment';
  quantity: number; // en retail_unit, positivo o negativo
  reference_id: string | null; // id de venta, remito o retiro de acopio
  created_by: string;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  tax_id: string | null;
  phone: string | null;
  account_balance: number; // deuda (+) o saldo a favor (-)
}

export interface Stockpile {
  id: string;
  client_id: string;
  product_id: string;
  total_reserved: number; // en retail_unit
  total_withdrawn: number; // en retail_unit
  remaining: number; // total_reserved - total_withdrawn
  created_at: string;
}

export interface Quote {
  id: string;
  client_id: string;
  items: QuoteItem[];
  valid_until: string;
  status: 'draft' | 'approved' | 'expired' | 'converted';
  created_at: string;
}

export interface QuoteItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface DeliveryNote {
  id: string;
  number: number; // numeración correlativa propia
  client_id: string;
  stockpile_id: string | null; // si es retiro contra acopio
  items: QuoteItem[];
  created_at: string;
}

export interface Sale {
  id: string;
  client_id: string;
  delivery_note_id: string | null;
  total_amount: number;
  payment_method: 'cash' | 'transfer';
  is_formal: boolean; // false = comprobante informal ("en negro")
  created_at: string;
}

export interface Stats {
  total_products: number;
  low_stock_count: number;
  active_stockpiles: number;
  sales_this_month: number;
}
