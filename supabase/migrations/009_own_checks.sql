-- Cheques propios (emitidos por el negocio a proveedores u otros).
create table public.own_checks (
  id uuid default gen_random_uuid() primary key,
  payee text not null,
  check_number text not null,
  bank text not null,
  amount numeric not null,
  issue_date date not null default current_date,
  due_date date not null,
  status text not null default 'pending'
    check (status in ('pending', 'covered', 'rejected')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.own_checks enable row level security;

create policy "Authenticated users read own_checks" on public.own_checks
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create own_checks" on public.own_checks
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users update own_checks" on public.own_checks
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
