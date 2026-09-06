-- Permite que una venta se cobre combinando varias formas de pago
-- (ej. una parte en efectivo, otra en transferencia y otra en cheques).
-- sales.payment_method / sales.discount_percent quedan como resumen de
-- compatibilidad (se siguen completando cuando hay una sola forma de pago);
-- la fuente de verdad detallada es sale_payments.
alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales
  add constraint sales_payment_method_check check (payment_method in ('cash', 'transfer', 'checks', 'mixed'));

create table public.sale_payments (
  id uuid default gen_random_uuid() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  method text not null check (method in ('cash', 'transfer', 'checks')),
  amount numeric not null,
  discount_percent numeric not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  created_at timestamptz default now()
);

alter table public.sale_payments enable row level security;

create policy "Authenticated users read sale payments" on public.sale_payments
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create sale payments" on public.sale_payments
  for insert with check (auth.role() = 'authenticated');
