-- Cuánto movió cada venta la cuenta corriente del cliente:
-- total de la venta (remitos + productos) menos lo que el cliente entregó.
-- Positivo = el cliente quedó debiendo; negativo = entregó de más y le
-- quedó saldo a favor. 0 en ventas pagadas justo y en las ventas viejas.
alter table public.sales add column account_balance_change numeric not null default 0;
