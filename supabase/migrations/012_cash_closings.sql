-- Cierres de caja (arqueo por turno): compara el efectivo contado a mano
-- contra lo que debería haber según las ventas registradas desde el
-- cierre anterior. Es un registro de auditoría: no se edita ni se borra.
create table public.cash_closings (
  id uuid default gen_random_uuid() primary key,
  period_start timestamptz, -- null = desde el inicio de los registros (primer cierre)
  period_end timestamptz not null default now(),
  expected_cash numeric not null,
  counted_cash numeric not null,
  difference numeric generated always as (counted_cash - expected_cash) stored,
  transfer_total numeric not null default 0, -- informativo, no se arquea
  checks_total numeric not null default 0, -- informativo, no se arquea
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.cash_closings enable row level security;

create policy "Authenticated users read cash closings" on public.cash_closings
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create cash closings" on public.cash_closings
  for insert with check (auth.role() = 'authenticated');
