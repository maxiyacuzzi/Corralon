-- Completa las políticas de RLS que faltaban en 001_initial.sql.
-- Sin estas políticas, profiles/stockpiles/quotes/delivery_notes/sales
-- tienen RLS activado pero ninguna regla, por lo que quedan completamente
-- bloqueadas (incluido el login, que necesita leer profiles).

-- Perfiles: cada usuario lee su propio perfil. Es requisito para el login
-- y para que las políticas "solo owner" de otras tablas puedan resolver
-- el rol del usuario actual.
create policy "Users read own profile" on public.profiles
  for select using (auth.uid() = id);

-- Productos: cualquier usuario autenticado puede actualizar el stock
-- (lo hacen las Edge Functions al registrar movimientos). El alta/baja de
-- productos sigue restringida a "Owner manages products".
create policy "Authenticated users update stock" on public.products
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Clientes: cualquier usuario autenticado puede dar de alta clientes y
-- actualizar su cuenta corriente (lo hace la Edge Function register-sale).
create policy "Authenticated users create clients" on public.clients
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users update clients" on public.clients
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Acopios
create policy "Authenticated users read stockpiles" on public.stockpiles
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create stockpiles" on public.stockpiles
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users update stockpiles" on public.stockpiles
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Presupuestos
create policy "Authenticated users read quotes" on public.quotes
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create quotes" on public.quotes
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users update quotes" on public.quotes
  for update using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Remitos
create policy "Authenticated users read delivery notes" on public.delivery_notes
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create delivery notes" on public.delivery_notes
  for insert with check (auth.role() = 'authenticated');

-- Ventas
create policy "Authenticated users read sales" on public.sales
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users create sales" on public.sales
  for insert with check (auth.role() = 'authenticated');
