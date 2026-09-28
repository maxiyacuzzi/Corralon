-- Datos del cheque recibido que figuran en el papel: titular (puede no ser
-- el cliente que lo entregó, ej. un cheque de terceros endosado), su CUIT y
-- la fecha de emisión. Ojo: la columna vieja issue_date NO es la fecha de
-- emisión sino la fecha en que se recibió el cheque (se muestra como
-- "Recibido"). Nullable para no romper los cheques cargados antes.
alter table public.checks add column holder_name text;
alter table public.checks add column holder_tax_id text;
alter table public.checks add column emission_date date;
