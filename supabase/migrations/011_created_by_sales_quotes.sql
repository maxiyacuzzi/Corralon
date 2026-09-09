-- Atribución de usuario: quién cargó cada venta y cada presupuesto.
alter table public.sales add column created_by uuid references public.profiles(id);
alter table public.quotes add column created_by uuid references public.profiles(id);

-- Para mostrar "Cargado por <nombre>" hace falta poder leer el perfil de
-- OTROS usuarios del equipo, no solo el propio (la política existente
-- "Users read own profile" solo permite auth.uid() = id).
create policy "Authenticated users read all profiles" on public.profiles
  for select using (auth.role() = 'authenticated');
