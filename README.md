# Corralón

Aplicación web para gestión de un corralón de materiales de construcción y ferretería: stock y acopio de materiales, remitos, presupuestos y ventas.

## Stack

- React + Vite + TypeScript + TailwindCSS + React Router v6
- Supabase (Auth + Database + Edge Functions)

## Desarrollo

```bash
npm install
cp .env.example .env   # completar con las credenciales de tu proyecto Supabase
npm run dev
```

## Base de datos

Las migraciones están en `supabase/migrations/`. Las Edge Functions (`supabase/functions/`) corren en Deno y se despliegan con la Supabase CLI:

```bash
supabase db push
supabase functions deploy register-stock-movement
supabase functions deploy withdraw-stockpile
supabase functions deploy generate-delivery-note
```

## Módulos

- **Stock y Acopio** (prioridad del MVP): alta de productos con doble unidad de medida (a granel / minorista), movimientos de stock, acopios por cliente con retiros parciales.
- **Remitos**: generación con numeración correlativa, contra acopio o venta directa.
- **Presupuestos**: armado de ítems, aprobación y conversión.
- **Ventas**: registro con medio de pago, incluye comprobantes informales.

Fuera de alcance del MVP: facturación electrónica fiscal, app de consulta para el cliente final, compras a proveedores, logística de reparto, múltiples sucursales.
