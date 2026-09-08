-- Subcategorías: una categoría puede tener una categoría padre (un solo nivel de anidamiento en la UI).
alter table public.categories
  add column parent_id uuid references public.categories(id) on delete cascade;

alter table public.categories
  add constraint categories_parent_id_not_self check (parent_id is distinct from id);

create index categories_parent_id_idx on public.categories(parent_id);

-- El nombre pasa de ser único global a único por padre, para poder reutilizar
-- nombres de subcategoría (ej. "Chico"/"Grande") bajo categorías distintas.
alter table public.categories drop constraint categories_name_key;

create unique index categories_name_unique_top_level on public.categories(name) where parent_id is null;
create unique index categories_name_unique_per_parent on public.categories(parent_id, name) where parent_id is not null;
