-- Relación muchos-a-muchos: una venta puede facturar uno o varios remitos.
-- sales.delivery_note_id (columna original) queda en desuso; esta tabla es
-- la fuente de verdad para saber qué remitos cubre cada venta.
create table public.sale_delivery_notes (
  sale_id uuid references public.sales(id) on delete cascade not null,
  delivery_note_id uuid references public.delivery_notes(id) on delete restrict not null,
  primary key (sale_id, delivery_note_id)
);

alter table public.sale_delivery_notes enable row level security;

create policy "Authenticated users read sale delivery notes" on public.sale_delivery_notes
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create sale delivery notes" on public.sale_delivery_notes
  for insert with check (auth.role() = 'authenticated');
