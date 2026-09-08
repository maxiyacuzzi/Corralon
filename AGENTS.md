# AGENTS.md

Guía para agentes de IA (Claude Code y compatibles) que trabajen en este repositorio.

## Qué es este proyecto

Corralón: app web de gestión de stock y acopio para un corralón de materiales de
construcción y ferretería (remitos, presupuestos, ventas). Ver [README.md](README.md)
para el detalle de módulos y alcance del MVP.

## Stack

- React 19 + Vite 8 + TypeScript + TailwindCSS v4 + React Router v7
- Supabase (Auth + Postgres + Edge Functions en Deno)
- `jspdf` + `html2canvas-pro` para generar PDFs en el cliente (ver abajo)
- Lint: `oxlint` (no ESLint)

Varias de estas versiones son recientes (React 19, Tailwind v4, Vite 8, React
Router 7, Supabase JS v2 reciente): antes de asumir una API por conocimiento
previo, **consultá Context7** (ver abajo) si algo no compila o el comportamiento
no coincide con lo esperado.

## Comandos

```bash
npm run dev          # servidor de desarrollo
npm run build        # tsc -b && vite build
npm run lint         # oxlint
npm run preview
npm run test:e2e     # levanta vite en modo test + corre Cypress headless (una vez)
npm run test:e2e:open  # ídem pero abre el runner interactivo de Cypress
npm run cy:run        # solo Cypress headless (requiere el server ya corriendo)
npm run cy:open       # solo el runner interactivo (requiere el server ya corriendo)
npm run test:e2e:report  # corre test:e2e y abre el reporte HTML al terminar (macOS)
```

## Tests E2E (Cypress)

- `cypress/e2e/*.cy.ts` — un spec por módulo/página (login, dashboard,
  categorias, proveedores, productos, stock, acopios, clientes,
  cliente-detalle, presupuestos, remitos, ventas, valores). Cubre todas las
  páginas de `src/pages/`.
- Corren contra un backend **mockeado**, no contra el proyecto Supabase real:
  `cypress/support/mock-supabase.ts` intercepta toda llamada a
  `**/rest/v1/**` y `**/functions/v1/**` y responde contra una "base de
  datos" en memoria armada por spec vía `mockSupabase({ tabla: [...] })` /
  `mockFunction('nombre-de-la-función', { body })`. Replica lo mínimo de
  PostgREST que usa la app (`eq`/`gte`/`lte`/`in`, `order`, `limit`,
  `.single()`), pero no es una implementación completa: si una página nueva
  usa un operador de filtro no soportado, hay que sumarlo ahí, no simularlo
  a mano en cada spec.
- `cy.loginAs(path, profile?)` (en `cypress/support/commands.ts`) simula una
  sesión ya iniciada seteando en `localStorage` la key
  `sb-test-auth-token` (la que arma `@supabase/supabase-js` a partir de
  `VITE_SUPABASE_URL=https://test.supabase.co`, ver `.env.test`) antes de
  que la app monte — así `AuthContext` arranca autenticado sin pasar por el
  formulario de login ni por Supabase Auth real. El spec `login.cy.ts` es
  la excepción: ese sí ejercita el formulario real, interceptando
  `POST **/auth/v1/token?grant_type=password`.
- `.env.test` fija `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` a valores
  dummy (no son credenciales reales) — Vite los carga con `--mode test`,
  que es lo que usan los scripts `test:e2e*`. No pisa `.env` en desarrollo
  normal (`npm run dev` sigue usando `.env`).
- CI: `.github/workflows/cypress.yml` corre `npm run test:e2e` en cada push
  y PR a `main`. No necesita secrets porque el backend está mockeado.
- Reporte: `cypress-mochawesome-reporter` (configurado en `cypress.config.ts`)
  genera `cypress/reports/index.html` en cada corrida — un solo archivo
  autocontenido (screenshots de los fallos embebidas) que se puede abrir
  directo en el navegador. Carpeta gitignoreada, se regenera en cada run.

## Estructura

- `src/pages/` — una página por módulo (Products, Categories, Suppliers,
  Stock, Stockpiles, Clients, ClientDetail, Quotes, DeliveryNotes, Sales,
  Checks, Dashboard, Login).
- `src/components/` — formularios y piezas de UI reutilizadas entre páginas.
- `src/context/AuthContext.tsx` — sesión y rol de usuario (Supabase Auth).
- `src/lib/supabase.ts` — cliente Supabase.
- `src/lib/units.ts` — conversión entre unidad a granel (`bulk_unit`) y
  unidad minorista (`retail_unit`) de un producto.
- `src/lib/pdf.ts` — `elementToPdfFile(element, fileName)`: renderiza un
  nodo del DOM (una de las vistas *Preview) a un PDF vía `html2canvas-pro`
  + `jsPDF`, devuelve un `File`. Usa `html2canvas-pro` (no `html2canvas`
  a secas): Tailwind v4 compila todos sus colores a `oklch()`, y el
  `html2canvas` original no soporta ese formato de color (tira
  "unsupported color function") — `html2canvas-pro` es un fork con el
  mismo API que sí lo soporta.
- `src/components/ShareButton.tsx` — genera el PDF y lo comparte con
  `navigator.share({ files })` (Web Share API); si el navegador no
  soporta compartir archivos, descarga el PDF en su lugar. No hay forma
  de prellenar el número de WhatsApp del cliente junto con el archivo
  adjunto — es una limitación de la Web Share API, no del código; el
  usuario elige el contacto dentro de WhatsApp al compartir.
- `src/components/WhatsAppWebButton.tsx` — alternativa a `ShareButton`:
  descarga el PDF y abre `web.whatsapp.com/send?phone=...` con el
  teléfono del cliente (`clients.phone`, se limpia con
  `replace(/\D/g, '')`) y un mensaje precargado. WhatsApp Web no tiene
  forma de adjuntar un archivo vía URL, así que el PDF descargado hay
  que arrastrarlo al chat manualmente — no es un bug, es el límite real
  de lo que WhatsApp permite sin su API de Business.
- `src/types/index.ts` — tipos de dominio, reflejan el esquema de
  `supabase/migrations/001_initial.sql`.
- `supabase/functions/` — Edge Functions (Deno): `register-stock-movement`,
  `withdraw-stockpile`, `generate-delivery-note`, `register-sale`,
  `convert-quote`. La lógica que debe ser transaccional o validada del lado
  servidor vive acá, no en el cliente. Las funciones se componen entre sí
  vía `supabase.functions.invoke` (p. ej. `convert-quote` llama a
  `register-sale` y `register-stock-movement`).
- `supabase/migrations/` — esquema SQL y políticas RLS. `001_initial.sql` es
  el esquema base; `002_rls_policies.sql` completa las políticas que
  faltaban (sin ellas, varias tablas quedan bloqueadas por RLS aunque el
  código de la app sea correcto); `003_cash_discounts.sql` agrega
  `discount_percent` a `quotes`/`sales`; `004_sales_checks_payment.sql`
  suma `checks` como medio de pago válido en `sales`; `005_checks.sql`
  crea la tabla `checks` (valores/cheques recibidos);
  `006_sale_delivery_notes.sql` crea la tabla puente `sale_delivery_notes`
  (una venta puede facturar varios remitos — la columna vieja
  `sales.delivery_note_id` quedó en desuso, no se escribe más);
  `007_categories_suppliers.sql` crea `categories` y `suppliers`, y agrega
  `products.category_id` / `products.supplier_id` (ambos nullable, on
  delete set null); `008_sale_payments.sql` crea `sale_payments` (una
  venta puede pagarse combinando varias formas de pago) y permite
  `sales.payment_method = 'mixed'`.

## Modelo de dominio (clave)

- `products.current_stock` se maneja siempre en `retail_unit`;
  `conversion_factor` indica cuántas `retail_unit` hay por 1 `bulk_unit`.
- **Los remitos NO tienen precio.** `delivery_notes.items` es
  `DeliveryNoteItem[]` (`{ product_id, quantity }`, sin `unit_price`) —
  a propósito: un remito es solo comprobante de entrega. `QuoteItem`
  (con `unit_price`) sigue existiendo solo para `quotes.items`, donde sí
  hace falta congelar un precio para el presupuesto. Cuando una venta
  factura uno o varios remitos (`Sales.tsx` → `deliveryNoteTotal`), el
  monto se calcula con el **precio actual** de `products.price` en ese
  momento, no con ningún precio guardado en el remito — no reintroducir
  `unit_price` en `DeliveryNoteItem` ni en el formulario de remitos.
- `categories` y `suppliers` son catálogos simples (nombre + datos de
  contacto) para clasificar productos vía `products.category_id` /
  `products.supplier_id`. No implementan un flujo de compras a
  proveedores (eso sigue fuera de alcance del MVP) — son solo datos de
  referencia.
- Editar un producto (`ProductForm` con `product` seteado) nunca toca
  `current_stock`; los cambios de stock siempre pasan por el módulo Stock
  (`register-stock-movement`) para mantener el auditing en
  `stock_movements`.
- `stock_movements` es el registro de auditoría de todo cambio de stock
  (`purchase_in`, `sale_out`, `stockpile_out`, `adjustment`); `quantity` es
  positivo o negativo en `retail_unit`.
- `stockpiles` reserva stock por cliente+producto; `remaining =
  total_reserved - total_withdrawn`.
- Roles (`profiles.role`): `owner`, `salesperson`, `warehouse`. RLS en
  Postgres restringe por rol (ver políticas en la migración) — replicar esa
  misma restricción en la UI es solo cosmético, la fuente de verdad es RLS.
- `sales.is_formal = false` representa venta informal ("en negro"); no
  confundir con estado de pago.
- `sale_payments` es la fuente de verdad de cómo se cobró una venta: una
  fila por cada forma de pago usada (`method`: `cash` | `transfer` |
  `checks`, `amount` ya con descuento aplicado, `discount_percent` solo
  significativo para `cash`). `sales.total_amount` = suma de
  `sale_payments.amount`. `sales.payment_method` /
  `sales.discount_percent` son un resumen de compatibilidad: solo
  reflejan un valor real cuando la venta tiene una única forma de pago;
  si combina varias, `payment_method = 'mixed'` y `discount_percent = 0`
  — para el detalle real, siempre leer `sale_payments`. En `quotes`,
  `discount_percent` sigue siendo un único valor (representa el
  descuento que se aplicaría si el cliente paga todo en efectivo).
- `checks`: cheques recibidos. `register-sale` crea una fila de `checks`
  por cada línea de `sale_payments` con `method = 'checks'` que traiga
  datos de cheque (queda con `sale_id` seteado), o se cargan
  manualmente desde la página Valores (`sale_id` null). Estados:
  `in_wallet` → `deposited` → `cleared`, o `rejected` / `delivered` en
  cualquier punto antes de `cleared`.
- `DeliveryNotePreview`, `QuotePreview` y `SalePreview` son la excepción
  al tema oscuro del resto de la app: siempre fondo blanco/texto oscuro
  (look "papel"), a propósito — son la misma vista que se imprime y que
  se exporta a PDF para compartir, así que tienen que verse igual en
  pantalla, al imprimir y en el PDF compartido. No las vuelvas a poner
  en modo oscuro condicionado a `print:`.

## Convenciones de código

- Sin ESLint: el lint es `oxlint` (`.oxlintrc.json`), reglas mínimas
  (rules-of-hooks, only-export-components). No agregar config de ESLint.
- TypeScript estricto según `tsconfig.app.json`; evitar `any`.
- Componentes funcionales, sin clases.
- Los textos de la UI están en español (nombres de tablas y campos en
  inglés/snake_case, UI en español) — mantené esa convención en código nuevo.

## Variables de entorno

`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `.env.example`). Nunca
commitear `.env` ni credenciales reales.

## Uso de Context7 (MCP)

Este repo registra el servidor MCP `context7` en [.mcp.json](.mcp.json)
(`npx -y @upstash/context7-mcp`), que resuelve documentación actualizada de
librerías por nombre.

Usalo cuando:
- Vayas a usar una API de `react-router-dom` v7, TailwindCSS v4,
  `@supabase/supabase-js` v2, Vite 8 o React 19 que no estés seguro sea
  correcta o que pueda haber cambiado entre versiones mayores.
- Un error de build/tipo sugiere que una firma de función o config cambió
  respecto a lo que recordás.
- Vayas a escribir una Edge Function de Supabase (Deno) y necesites
  confirmar imports o APIs del runtime de Deno/Supabase.

Flujo: resolver el nombre de la librería a un id de Context7 y luego pedir
los docs de esa librería/tema antes de escribir código que dependa de una
API específica de una versión.
