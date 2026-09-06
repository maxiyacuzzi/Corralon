-- Agrega "Valores" (pago con cheques) como medio de pago de ventas.
alter table public.sales drop constraint if exists sales_payment_method_check;
alter table public.sales
  add constraint sales_payment_method_check check (payment_method in ('cash', 'transfer', 'checks'));
