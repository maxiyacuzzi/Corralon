-- Editar monto o cliente de un cheque cargado suelto (cobro a cuenta,
-- sale_id null) corrige la cuenta corriente: se revierte lo que descontó
-- el monto viejo al cliente viejo y se descuenta el monto nuevo al cliente
-- nuevo. La UI solo permite este cambio con el cheque en cartera; los
-- cheques de venta no mueven la cuenta por sí mismos (ver 017), y los
-- rechazados/devueltos ya devolvieron el monto al cliente.
create or replace function public.checks_amount_client_change()
returns trigger
language plpgsql
as $$
begin
  if new.sale_id is null
     and old.status not in ('rejected', 'returned')
     and (new.amount is distinct from old.amount or new.client_id is distinct from old.client_id) then
    update public.clients
      set account_balance = coalesce(account_balance, 0) + old.amount
      where id = old.client_id;
    update public.clients
      set account_balance = coalesce(account_balance, 0) - new.amount
      where id = new.client_id;
  end if;
  return new;
end;
$$;

create trigger checks_amount_client_change
  after update of amount, client_id on public.checks
  for each row execute function public.checks_amount_client_change();
