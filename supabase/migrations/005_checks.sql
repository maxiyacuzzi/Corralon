-- Valores (cheques) recibidos de clientes.
create table public.checks (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete restrict not null,
  sale_id uuid references public.sales(id) on delete set null,
  check_number text not null,
  bank text not null,
  amount numeric not null,
  issue_date date not null default current_date,
  due_date date not null,
  is_deferred boolean not null default false,
  status text not null default 'in_wallet'
    check (status in ('in_wallet', 'deposited', 'cleared', 'rejected', 'delivered')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.checks enable row level security;

create policy "Authenticated users read checks" on public.checks
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create checks" on public.checks
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users update checks" on public.checks
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
