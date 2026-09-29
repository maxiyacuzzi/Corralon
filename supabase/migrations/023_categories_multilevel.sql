-- Subcategorías de cualquier profundidad. El esquema ya lo permitía
-- (parent_id autorreferente, 010); la UI limitaba a un nivel. Con varios
-- niveles hay que impedir ciclos (A -> B -> A), que la constraint de 010
-- solo cubre para el caso de una categoría apuntándose a sí misma.
-- Numerada 023 (y no 020) porque 020-022 ya existen en la rama
-- feature/cuenta-corriente-proveedores.
create or replace function public.categories_prevent_cycle()
returns trigger
language plpgsql
as $$
declare
  current_id uuid := new.parent_id;
begin
  while current_id is not null loop
    if current_id = new.id then
      raise exception 'Una categoría no puede quedar dentro de una de sus propias subcategorías';
    end if;
    select parent_id into current_id from public.categories where id = current_id;
  end loop;
  return new;
end;
$$;

create trigger categories_prevent_cycle
  before insert or update of parent_id on public.categories
  for each row execute function public.categories_prevent_cycle();
