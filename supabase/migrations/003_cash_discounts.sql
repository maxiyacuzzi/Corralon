-- Descuento por pago en efectivo, aplicable en presupuestos y ventas.
alter table public.quotes
  add column discount_percent numeric not null default 0
  check (discount_percent >= 0 and discount_percent <= 100);

alter table public.sales
  add column discount_percent numeric not null default 0
  check (discount_percent >= 0 and discount_percent <= 100);
