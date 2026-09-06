-- Categorías y proveedores de productos.
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  created_at timestamptz default now()
);

create table public.suppliers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  tax_id text,
  phone text,
  created_at timestamptz default now()
);

alter table public.categories enable row level security;
alter table public.suppliers enable row level security;

create policy "Authenticated users read categories" on public.categories
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create categories" on public.categories
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users update categories" on public.categories
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users read suppliers" on public.suppliers
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create suppliers" on public.suppliers
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users update suppliers" on public.suppliers
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

alter table public.products
  add column category_id uuid references public.categories(id) on delete set null,
  add column supplier_id uuid references public.suppliers(id) on delete set null;
