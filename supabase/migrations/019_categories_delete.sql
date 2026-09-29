-- Permite eliminar categorías (007 solo creó políticas de select/insert/update:
-- sin esta, un delete no falla pero no borra nada por RLS).
-- Al borrar una categoría, sus subcategorías se borran en cascada
-- (categories.parent_id on delete cascade) y los productos quedan sin
-- categoría (products.category_id on delete set null).
create policy "Authenticated users delete categories" on public.categories
  for delete using (auth.role() = 'authenticated');
