-- Compra "a cuenta corriente": no se paga nada en el momento, todo el
-- total queda como deuda con el proveedor (amount_paid = 0,
-- account_balance_change = total; el trigger de 020 lo suma al saldo).
-- Numerada 024: 023 ya existe en la rama feature/editar-eliminar-categorias.
alter table public.purchases drop constraint if exists purchases_payment_method_check;
alter table public.purchases
  add constraint purchases_payment_method_check
  check (payment_method in ('cash', 'transfer', 'checks', 'account'));
