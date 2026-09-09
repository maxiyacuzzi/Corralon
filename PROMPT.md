# Brief del proyecto

<!-- Pegá acá la descripción completa del proyecto -->

## DESCRIPCIÓN DEL PROYECTO

Construí una aplicación web completa para gestión de un **corralón de materiales de construcción y ferretería**, usando **React + Vite + TypeScript + TailwindCSS** en el frontend y **Supabase** como backend y base de datos. La app resuelve tres problemas centrales del rubro: control de stock/acopio de materiales (a granel y por unidad), generación de remitos y presupuestos, y facturación simplificada incluyendo operaciones informales ("en negro").

**Importante sobre el flujo de negocio:** un cliente puede comprar/reservar un volumen de material ("acopio") y retirarlo en varias entregas parciales a lo largo del tiempo. Cada retiro descuenta tanto del saldo de acopio del cliente como del stock general del corralón. La prioridad del MVP es el módulo de **Stock y Acopio**; remitos, presupuestos y facturación se apoyan sobre esa base.

---

## STACK TECNOLÓGICO

- **Frontend:** React + Vite + TypeScript + TailwindCSS + React Router v6
- **Backend:** Supabase (Auth + Database + Edge Functions)
- **Base de datos:** PostgreSQL via Supabase
- **HTTP Client:** Axios
- **Iconos:** Lucide React
- **Tipos:** TypeScript estricto en todo el proyecto

---

## ESTRUCTURA DE ARCHIVOS

```
corralon/
├── supabase/
│   ├── functions/
│   │   ├── register-stock-movement/
│   │   │   └── index.ts        ← Edge Function para ingresos/egresos/ajustes de stock
│   │   ├── withdraw-stockpile/
│   │   │   └── index.ts        ← Edge Function para retiro parcial de acopio
│   │   └── generate-delivery-note/
│   │       └── index.ts        ← Edge Function para generar remito (PDF)
│   └── migrations/
│       └── 001_initial.sql
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types/
│   │   └── index.ts            ← Todos los tipos TypeScript
│   ├── lib/
│   │   ├── supabase.ts         ← Cliente Supabase
│   │   └── units.ts            ← Helpers de conversión de unidades (bolsa/kg, m³/unidad)
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Products.tsx
│   │   ├── Stock.tsx
│   │   ├── Stockpiles.tsx
│   │   ├── Clients.tsx
│   │   ├── Quotes.tsx
│   │   ├── DeliveryNotes.tsx
│   │   └── Sales.tsx
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── StatCard.tsx
│   │   ├── ProductForm.tsx
│   │   ├── StockMovementForm.tsx
│   │   ├── StockpileWithdrawForm.tsx
│   │   └── DeliveryNotePreview.tsx
│   └── context/
│       └── AuthContext.tsx
├── .env
└── package.json
```

---

## TIPOS TYPESCRIPT (src/types/index.ts)

```tsx
export type UserRole = 'owner' | 'salesperson' | 'warehouse';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  bulk_unit: string;      // ej: 'm3', 'ton', 'bolsa'
  retail_unit: string;    // ej: 'kg', 'unidad'
  conversion_factor: number; // cuántas retail_unit hay por 1 bulk_unit
  current_stock: number;  // en retail_unit
  min_stock_alert: number;
  price: number;
}

export interface StockMovement {
  id: string;
  product_id: string;
  type: 'purchase_in' | 'sale_out' | 'stockpile_out' | 'adjustment';
  quantity: number; // en retail_unit, positivo o negativo
  reference_id: string | null; // id de venta, remito o retiro de acopio
  created_by: string;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  tax_id: string | null;
  phone: string | null;
  account_balance: number; // deuda (+) o saldo a favor (-)
}

export interface Stockpile {
  id: string;
  client_id: string;
  product_id: string;
  total_reserved: number;  // en retail_unit
  total_withdrawn: number; // en retail_unit
  remaining: number;       // total_reserved - total_withdrawn
  created_at: string;
}

export interface Quote {
  id: string;
  client_id: string;
  items: QuoteItem[];
  valid_until: string;
  status: 'draft' | 'approved' | 'expired' | 'converted';
  created_at: string;
}

export interface QuoteItem {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface DeliveryNote {
  id: string;
  number: number; // numeración correlativa propia
  client_id: string;
  stockpile_id: string | null; // si es retiro contra acopio
  items: QuoteItem[];
  created_at: string;
}

export interface Sale {
  id: string;
  client_id: string;
  delivery_note_id: string | null;
  total_amount: number;
  payment_method: 'cash' | 'transfer';
  is_formal: boolean; // false = comprobante informal ("en negro")
  created_at: string;
}

export interface Stats {
  total_products: number;
  low_stock_count: number;
  active_stockpiles: number;
  sales_this_month: number;
}
```

---

## BASE DE DATOS SUPABASE (supabase/migrations/001_initial.sql)

```sql
-- Habilitar RLS
alter table auth.users enable row level security;

-- Perfiles (extiende auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null default 'salesperson' check (role in ('owner', 'salesperson', 'warehouse')),
  created_at timestamptz default now()
);

-- Productos con doble unidad de medida
create table public.products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  bulk_unit text not null,
  retail_unit text not null,
  conversion_factor numeric not null default 1,
  current_stock numeric not null default 0,
  min_stock_alert numeric default 0,
  price numeric not null default 0,
  created_at timestamptz default now()
);

-- Movimientos de stock
create table public.stock_movements (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade,
  type text not null check (type in ('purchase_in', 'sale_out', 'stockpile_out', 'adjustment')),
  quantity numeric not null,
  reference_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Clientes
create table public.clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  tax_id text,
  phone text,
  account_balance numeric default 0,
  created_at timestamptz default now()
);

-- Acopios (saldo reservado por cliente y producto)
create table public.stockpiles (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id) on delete cascade,
  product_id uuid references public.products(id),
  total_reserved numeric not null default 0,
  total_withdrawn numeric not null default 0,
  created_at timestamptz default now()
);

-- Presupuestos
create table public.quotes (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id),
  items jsonb not null default '[]',
  valid_until date,
  status text default 'draft' check (status in ('draft', 'approved', 'expired', 'converted')),
  created_at timestamptz default now()
);

-- Remitos
create table public.delivery_notes (
  id uuid default gen_random_uuid() primary key,
  number bigint generated always as identity,
  client_id uuid references public.clients(id),
  stockpile_id uuid references public.stockpiles(id),
  items jsonb not null default '[]',
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- Ventas / comprobantes informales
create table public.sales (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.clients(id),
  delivery_note_id uuid references public.delivery_notes(id),
  total_amount numeric not null,
  payment_method text check (payment_method in ('cash', 'transfer')),
  is_formal boolean default false,
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.stock_movements enable row level security;
alter table public.clients enable row level security;
alter table public.stockpiles enable row level security;
alter table public.quotes enable row level security;
alter table public.delivery_notes enable row level security;
alter table public.sales enable row level security;

-- Todos los usuarios autenticados del corralón pueden leer catálogo, stock y clientes
create policy "Authenticated users read products" on public.products
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users read clients" on public.clients
  for select using (auth.role() = 'authenticated');

-- Solo owner puede modificar precios y productos
create policy "Owner manages products" on public.products
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'owner')
  );

-- Vendedor y depósito pueden registrar movimientos de stock
create policy "Sales and warehouse insert stock movements" on public.stock_movements
  for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('owner', 'salesperson', 'warehouse'))
  );

create policy "Authenticated users read stock movements" on public.stock_movements
  for select using (auth.role() = 'authenticated');
```

---

## SUPABASE EDGE FUNCTIONS

### register-stock-movement (supabase/functions/register-stock-movement/index.ts)

```tsx
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { product_id, type, quantity, reference_id } = await req.json()
  const authHeader = req.headers.get('Authorization')!

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })

  // Registrar el movimiento
  const { error: insertError } = await supabase.from('stock_movements').insert({
    product_id,
    type,
    quantity,
    reference_id,
    created_by: user.id,
  })

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), { status: 400 })
  }

  // Actualizar stock actual del producto
  const { data: product } = await supabase
    .from('products')
    .select('current_stock')
    .eq('id', product_id)
    .single()

  const newStock = (product?.current_stock ?? 0) + quantity

  await supabase.from('products').update({ current_stock: newStock }).eq('id', product_id)

  return new Response(JSON.stringify({ success: true, new_stock: newStock }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### withdraw-stockpile (supabase/functions/withdraw-stockpile/index.ts)

```tsx
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const { stockpile_id, quantity } = await req.json()
  const authHeader = req.headers.get('Authorization')!

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response(JSON.stringify({ error: 'No autorizado' }), { status: 401 })

  const { data: stockpile } = await supabase
    .from('stockpiles')
    .select('product_id, total_reserved, total_withdrawn')
    .eq('id', stockpile_id)
    .single()

  if (!stockpile) return new Response(JSON.stringify({ error: 'Acopio no encontrado' }), { status: 404 })

  const remaining = stockpile.total_reserved - stockpile.total_withdrawn
  if (quantity > remaining) {
    return new Response(
      JSON.stringify({ error: `Saldo de acopio insuficiente. Disponible: ${remaining}` }),
      { status: 400 }
    )
  }

  // Actualizar acopio
  await supabase
    .from('stockpiles')
    .update({ total_withdrawn: stockpile.total_withdrawn + quantity })
    .eq('id', stockpile_id)

  // Descontar del stock general
  await supabase.functions.invoke('register-stock-movement', {
    body: {
      product_id: stockpile.product_id,
      type: 'stockpile_out',
      quantity: -quantity,
      reference_id: stockpile_id,
    },
  })

  return new Response(JSON.stringify({ success: true, remaining: remaining - quantity }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

---

## CLIENTE SUPABASE (src/lib/supabase.ts)

```tsx
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

---

## VARIABLES DE ENTORNO (.env)

```
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

---

## AUTENTICACIÓN CON SUPABASE AUTH

- Usar `supabase.auth.signInWithPassword({ email, password })` para login
- Usar `supabase.auth.signOut()` para logout
- Usar `supabase.auth.getUser()` para obtener el usuario actual
- Al registrar un usuario, crear también su registro en `public.profiles` con el rol correspondiente (owner, salesperson, warehouse)
- `AuthContext.tsx` debe exponer: `user`, `profile`, `loading`, `signIn`, `signOut`

---

## FUNCIONALIDADES A IMPLEMENTAR

### 1. LOGIN

- Formulario email + password con Supabase Auth
- Al iniciar sesión, leer el `role` desde `public.profiles`
- Redirigir según rol a la pantalla correspondiente

### 2. MÓDULO DE PRODUCTOS Y STOCK (prioridad 1)

- Alta de producto con `bulk_unit`, `retail_unit` y `conversion_factor` (ej: 1 bolsa = 25 kg)
- Listado de productos con stock actual y alerta visual si está bajo `min_stock_alert`
- Formulario de movimiento de stock (ingreso por compra, ajuste manual) → llama a Edge Function `register-stock-movement`
- Historial de movimientos por producto

### 3. MÓDULO DE ACOPIO (prioridad 1)

- Alta de acopio: cliente + producto + cantidad reservada
- Vista de saldo restante por cliente y producto
- Formulario de retiro parcial → llama a Edge Function `withdraw-stockpile`
- Historial de retiros por acopio

### 4. MÓDULO DE REMITOS (prioridad 2)

- Generación de remito al confirmar una entrega (venta directa o retiro de acopio)
- Numeración correlativa automática (columna `number` con `generated always as identity`)
- Vista imprimible/PDF con datos del cliente, ítems, cantidades y saldo de acopio restante si aplica

### 5. MÓDULO DE PRESUPUESTOS (prioridad 3)

- Armado de presupuesto con ítems, cantidades y precios vigentes
- Estado: draft / approved / expired / converted
- Botón "Convertir a acopio" o "Convertir a venta directa"

### 6. MÓDULO DE VENTAS Y FACTURACIÓN INFORMAL (prioridad 4)

- Registro de venta con medio de pago (efectivo, transferencia)
- Campo `is_formal` (por defecto `false` para el MVP)
- Actualización de `account_balance` del cliente (cuenta corriente simple)

### 7. DASHBOARD

- Tarjetas: total de productos, productos con stock bajo, acopios activos, ventas del mes
- Tabla con últimos movimientos de stock y remitos generados

---

## DISEÑO UI

- Fondo general: `gray-950` o `gray-900`
- Sidebar oscuro con nombre del corralón
- Tarjetas con fondo `gray-800` y borde `gray-700`
- Color primario: `orange-600` (asociado al rubro construcción/ferretería)
- Estados: verde (`green-500`) stock ok, amarillo (`yellow-500`) stock bajo, rojo (`red-500`) sin stock
- Tipografía limpia Inter o system-ui
- Todos los textos en español
- Diseño mobile-first para las pantallas de depósito (consulta rápida desde celular)

---

## NOTAS IMPORTANTES

- Todo el código debe estar en **TypeScript estricto**, sin usar `any`
- Usar interfaces tipadas para todas las respuestas de Supabase
- Las Edge Functions corren en Deno, no en Node.js
- Manejar todos los errores de Supabase con mensajes en español
- Usar `React.FC` con props tipadas en todos los componentes
- Configurar `tsconfig.json` con `strict: true`
- Contemplar conectividad inestable: mostrar estado de guardado ("guardando...", "guardado", "error de conexión") en formularios clave (stock, retiro de acopio)
- **Fuera de alcance de este MVP:** facturación electrónica fiscal (ARCA), app para que el cliente final consulte su acopio, gestión de compras a proveedores, logística de reparto, múltiples sucursales