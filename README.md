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
supabase functions deploy register-sale
supabase functions deploy convert-quote
```

## Módulos

- **Stock y Acopio** (prioridad del MVP): alta y edición de productos con doble unidad de medida (a granel / minorista), categoría y proveedor, movimientos de stock, acopios por cliente con retiros parciales.
- **Categorías y Proveedores**: catálogos simples para clasificar productos (no incluye gestión de compras a proveedores).
- **Remitos**: generación con numeración correlativa, contra acopio o venta directa.
- **Presupuestos**: armado de ítems, aprobación y conversión.
- **Ventas**: registro con una o varias formas de pago combinadas (efectivo, transferencia, valores), descuento por pago en efectivo, incluye comprobantes informales.
- **Valores**: historial de cheques recibidos (cliente, banco, número, fechas de recepción/cobro, común o diferido, estado). Se generan automáticamente al registrar una venta pagada con "Valores", y también se pueden cargar manualmente.

Los remitos, presupuestos y ventas se pueden imprimir o compartir como PDF:
- **Compartir**: usa el selector nativo de apps del celular/PC — el usuario elige el contacto de WhatsApp ahí.
- **Abrir WhatsApp Web**: descarga el PDF y abre directamente el chat de `web.whatsapp.com` con el teléfono guardado del cliente y un mensaje precargado; el PDF descargado hay que arrastrarlo al chat a mano (WhatsApp no permite adjuntar un archivo vía link).

Fuera de alcance del MVP: facturación electrónica fiscal, app de consulta para el cliente final, compras a proveedores, logística de reparto, múltiples sucursales, envío automático por WhatsApp Business API.
