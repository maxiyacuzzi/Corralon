-- Cheques y cuenta corriente del cliente.
-- * Un cheque cargado suelto (sale_id null, desde Valores) es un cobro a
--   cuenta: descuenta su monto de clients.account_balance. Los cheques que
--   vienen de una venta no, porque register-sale ya los cuenta como pago.
-- * Si un cheque (de venta o suelto) pasa a 'rejected', el cliente vuelve a
--   deberlo: se suma su monto de nuevo a la cuenta corriente.
-- Va en un trigger (y no en el cliente) para que el cheque y el saldo se
-- actualicen en la misma transacción.
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
    if new.status = 'rejected' and old.status is distinct from 'rejected' then
      update public.clients
        set account_balance = coalesce(account_balance, 0) + new.amount
        where id = new.client_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger checks_account_balance
  after insert or update of status on public.checks
  for each row execute function public.checks_update_account_balance();
