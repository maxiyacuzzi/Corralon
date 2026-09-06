-- Habilitar RLS
alter table auth.users enable row level security;

-- Perfiles (extiende auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null default 'salesperson' check (role in ('owner', 'salesperson', 'warehouse')),
  created_at timestamptz default now()
);

-- Productos con doble unidad de medida
create table public.products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  bulk_unit text not null,
  retail_unit text not null,
  conversion_factor numeric not null default 1,
  current_stock numeric not null default 0,
  min_stock_alert numeric default 0,
  price numeric not null default 0,
  created_at timestamptz default now()
);

-- Movimientos de stock
create table public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade,
  type text not null check (type in ('purchase_in', 'sale_out', 'stockpile_out', 'adjustment')),
  quantity numeric not null,
  reference_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Clientes
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  tax_id text,
  phone text,
  account_balance numeric default 0,
  created_at timestamptz default now()
);

-- Acopios (saldo reservado por cliente y producto)
create table public.stockpiles (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade,
  product_id uuid references public.products(id),
  total_reserved numeric not null default 0,
  total_withdrawn numeric not null default 0,
  created_at timestamptz default now()
);

-- Presupuestos
create table public.quotes (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id),
  items jsonb not null default '[]',
  valid_until date,
  status text default 'draft' check (status in ('draft', 'approved', 'expired', 'converted')),
  created_at timestamptz default now()
);

-- Remitos
create table public.delivery_notes (
  id uuid default gen_random_uuid() primary key,
  number bigint generated always as identity,
  client_id uuid references public.clients(id),
  stockpile_id uuid references public.stockpiles(id),
  items jsonb not null default '[]',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Ventas / comprobantes informales
create table public.sales (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id),
  delivery_note_id uuid references public.delivery_notes(id),
  total_amount numeric not null,
  payment_method text check (payment_method in ('cash', 'transfer')),
  is_formal boolean default false,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.clients enable row level security;
alter table public.stockpiles enable row level security;
alter table public.quotes enable row level security;
alter table public.delivery_notes enable row level security;
alter table public.sales enable row level security;

-- Todos los usuarios autenticados del corralón pueden leer catálogo, stock y clientes
create policy "Authenticated users read products" on public.products
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users read clients" on public.clients
  for select using (auth.role() = 'authenticated');

-- Solo owner puede modificar precios y productos
create policy "Owner manages products" on public.products
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );

-- Vendedor y depósito pueden registrar movimientos de stock
create policy "Sales and warehouse insert stock movements" on public.stock_movements
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'salesperson', 'warehouse'))
  );

create policy "Authenticated users read stock movements" on public.stock_movements
  for select using (auth.role() = 'authenticated');
