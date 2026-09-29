-- Entrega de cheques de terceros a proveedores, y estado "devuelto".
--
-- * Al pasar un cheque a 'delivered' hay que indicar a qué proveedor
--   (delivered_supplier_id). Si delivered_as_payment, se registra solo un
--   supplier_payments (method 'checks') que descuenta la deuda con ese
--   proveedor, y queda enlazado en checks.supplier_payment_id.
-- * Nuevo estado 'returned' (devuelto). Si un cheque pasa a 'rejected' o
--   'returned':
--     - el cliente que lo dio vuelve a deberlo (clients.account_balance += monto)
--     - si había sido un pago a un proveedor, ese pago se anula
--       (supplier_payments.voided_at) y la deuda con el proveedor vuelve.

alter table public.checks drop constraint if exists checks_status_check;
alter table public.checks
  add constraint checks_status_check
  check (status in ('in_wallet', 'deposited', 'cleared', 'rejected', 'delivered', 'returned'));

alter table public.checks
  add column delivered_supplier_id uuid references public.suppliers(id) on delete set null,
  add column delivered_as_payment boolean not null default false,
  add column supplier_payment_id uuid references public.supplier_payments(id) on delete set null;

alter table public.supplier_payments
  add column voided_at timestamptz,
  add column void_reason text;

-- security definer: tiene que poder insertar/anular supplier_payments y
-- mover el saldo del proveedor aunque RLS no tenga política de update ahí.
create or replace function public.checks_before_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  voided_supplier_id uuid;
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' then
    if new.delivered_supplier_id is null then
      raise exception 'Elegí a qué proveedor se entrega el cheque';
    end if;
    if new.delivered_as_payment and new.supplier_payment_id is null then
      -- El trigger de supplier_payments descuenta el monto de la deuda con el proveedor.
      insert into public.supplier_payments (supplier_id, payment_date, method, amount, notes, created_by)
        values (new.delivered_supplier_id, current_date, 'checks', new.amount,
                'Cheque N.º ' || new.check_number || ' — ' || new.bank, auth.uid())
        returning id into new.supplier_payment_id;
    end if;
  end if;

  if new.status in ('rejected', 'returned')
     and old.status not in ('rejected', 'returned')
     and new.supplier_payment_id is not null then
    update public.supplier_payments
      set voided_at = now(),
          void_reason = case new.status when 'rejected' then 'Cheque rechazado' else 'Cheque devuelto' end
      where id = new.supplier_payment_id and voided_at is null
      returning supplier_id into voided_supplier_id;
    if voided_supplier_id is not null then
      update public.suppliers
        set account_balance = account_balance + new.amount
        where id = voided_supplier_id;
    end if;
  end if;

  return new;
end;
$$;

create trigger checks_before_status_change
  before update of status on public.checks
  for each row execute function public.checks_before_status_change();

-- Reemplaza la de 017: ahora 'returned' también le vuelve a sumar el monto al cliente.
create or replace function public.checks_update_account_balance()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.sale_id is null then
      update public.clients
        set account_balance = coalesce(account_balance, 0) - new.amount
        where id = new.client_id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.status in ('rejected', 'returned') and old.status not in ('rejected', 'returned') then
      update public.clients
        set account_balance = coalesce(account_balance, 0) + new.amount
        where id = new.client_id;
    end if;
  end if;
  return new;
end;
$$;
