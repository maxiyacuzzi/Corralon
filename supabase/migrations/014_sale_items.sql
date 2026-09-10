-- Permite cargar productos directamente en una venta (venta de mostrador,
-- sin remito previo). Igual que quotes/delivery_notes, guarda un array de
-- ítems; queda null en las ventas que solo facturan remitos ya generados.
alter table public.sales add column items jsonb;
