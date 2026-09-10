export type UserRole = 'owner' | 'salesperson' | 'warehouse';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Profile {
  id: string;
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
  category_id: string | null;
  supplier_id: string | null;
}

export interface Category {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  tax_id: string | null;
  phone: string | null;
  created_at: string;
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
  discount_percent: number; // descuento por pago en efectivo, 0-100
  created_by: string | null;
  created_at: string;
}

export interface QuoteItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface DeliveryNoteItem {
  product_id: string;
  quantity: number;
}

export interface DeliveryNote {
  id: string;
  number: number; // numeración correlativa propia
  client_id: string;
  stockpile_id: string | null; // si es retiro contra acopio
  items: DeliveryNoteItem[]; // sin precio: el remito es solo comprobante de entrega
  created_at: string;
}

export interface SaleDeliveryNote {
  sale_id: string;
  delivery_note_id: string;
}

export type PaymentMethod = 'cash' | 'transfer' | 'checks';

export interface SalePayment {
  id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number; // ya con el descuento por pago en efectivo aplicado, si corresponde
  discount_percent: number; // solo aplica a method 'cash', 0-100
  created_at: string;
}

export interface SaleItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface Sale {
  id: string;
  client_id: string;
  delivery_note_id: string | null; // en desuso, ver sale_delivery_notes
  items: SaleItem[] | null; // productos cargados directo en la venta (sin remito previo)
  total_amount: number; // suma de sale_payments, ya con descuentos aplicados
  payment_method: PaymentMethod | 'mixed'; // resumen: 'mixed' si combina más de una forma de pago
  is_formal: boolean; // false = comprobante informal ("en negro")
  discount_percent: number; // solo significativo si payment_method no es 'mixed'; ver sale_payments para el detalle
  created_by: string | null;
  created_at: string;
}

export interface Stats {
  total_products: number;
  low_stock_count: number;
  active_stockpiles: number;
  sales_this_month: number;
}

export type CheckStatus = 'in_wallet' | 'deposited' | 'cleared' | 'rejected' | 'delivered';

export interface Check {
  id: string;
  client_id: string; // quién lo dio
  sale_id: string | null; // venta asociada, si corresponde
  check_number: string;
  bank: string;
  amount: number;
  issue_date: string; // cuándo se recibió
  due_date: string; // cuándo se cobra
  is_deferred: boolean; // cheque de pago diferido vs. cheque común
  status: CheckStatus;
  notes: string | null;
  created_at: string;
}

export type OwnCheckStatus = 'pending' | 'covered' | 'rejected';

export interface OwnCheck {
  id: string;
  payee: string; // a quién se lo dimos
  check_number: string;
  bank: string;
  amount: number;
  issue_date: string; // cuándo lo emitimos
  due_date: string; // cuándo hay que cubrirlo
  status: OwnCheckStatus;
  notes: string | null;
  created_at: string;
}
