-- Domicilio real del cliente.
alter table public.clients add column address text;

-- Direcciones de obra: un cliente puede tener cero o más.
create table public.client_work_addresses (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  label text not null, -- ej: "Obra Ruta 9 km 45"
  address text not null,
  created_at timestamptz default now()
);

alter table public.client_work_addresses enable row level security;

create policy "Authenticated users read client work addresses" on public.client_work_addresses
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create client work addresses" on public.client_work_addresses
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users delete client work addresses" on public.client_work_addresses
  for delete using (auth.role() = 'authenticated');

-- El remito congela la dirección elegida al generarse: si el domicilio
-- del cliente cambia después, los remitos viejos no deben cambiar.
alter table public.delivery_notes add column delivery_address text;
