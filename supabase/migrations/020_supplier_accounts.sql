-- Cuenta corriente con proveedores: lo que el negocio les debe.
-- suppliers.account_balance: + le debemos al proveedor, - saldo a nuestro favor.
alter table public.suppliers add column account_balance numeric not null default 0;

-- Una compra puede pagarse en parte: lo que no se paga queda a cuenta.
-- account_balance_change = total_amount - amount_paid (lo que la compra sumó a la deuda).
alter table public.purchases add column amount_paid numeric;
update public.purchases set amount_paid = total_amount;
alter table public.purchases alter column amount_paid set not null;
alter table public.purchases add column account_balance_change numeric not null default 0;

-- Pagos a proveedores fuera de una compra (para saldar deuda).
create table public.supplier_payments (
  id uuid default gen_random_uuid() primary key,
  supplier_id uuid references public.suppliers(id) on delete restrict not null,
  payment_date date not null default current_date,
  method text not null check (method in ('cash', 'transfer', 'checks')),
  amount numeric not null check (amount > 0),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

alter table public.supplier_payments enable row level security;

create policy "Authenticated users read supplier payments" on public.supplier_payments
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create supplier payments" on public.supplier_payments
  for insert with check (auth.role() = 'authenticated');

-- El saldo se actualiza en la misma transacción que la compra o el pago.
create or replace function public.update_supplier_account_balance()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'purchases' then
    if new.account_balance_change <> 0 then
      update public.suppliers
        set account_balance = account_balance + new.account_balance_change
        where id = new.supplier_id;
    end if;
  elsif tg_table_name = 'supplier_payments' then
    update public.suppliers
      set account_balance = account_balance - new.amount
      where id = new.supplier_id;
  end if;
  return new;
end;
$$;

create trigger purchases_supplier_account_balance
  after insert on public.purchases
  for each row execute function public.update_supplier_account_balance();

create trigger supplier_payments_account_balance
  after insert on public.supplier_payments
  for each row execute function public.update_supplier_account_balance();
