-- Compras a proveedores. Cada compra suma stock de sus productos vía
-- register-purchase -> register-stock-movement (tipo purchase_in, con
-- reference_id = purchases.id), así queda el auditing en stock_movements.
-- items: [{ product_id, quantity, unit, unit_cost, retail_quantity }]
--   quantity/unit_cost: tal como se cargó (unit 'bulk' o 'retail')
--   retail_quantity: lo que se sumó al stock, siempre en retail_unit
create table public.purchases (
  id uuid default gen_random_uuid() primary key,
  supplier_id uuid references public.suppliers(id) on delete restrict not null,
  purchase_date date not null default current_date,
  payment_method text not null check (payment_method in ('cash', 'transfer', 'checks')),
  items jsonb not null,
  total_amount numeric not null,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.purchases enable row level security;

create policy "Authenticated users read purchases" on public.purchases
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create purchases" on public.purchases
  for insert with check (auth.role() = 'authenticated');
