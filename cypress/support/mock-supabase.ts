/**
 * Mock genérico del backend de Supabase (PostgREST + Edge Functions) para los
 * tests E2E. No pega contra el proyecto real: intercepta toda llamada a
 * `**\/rest/v1/**` y `**\/functions/v1/**` y responde contra una "base de
 * datos" en memoria armada a partir del seed que le pasa cada spec.
 *
 * Replica lo mínimo de la semántica de PostgREST que usa la app: filtros
 * `eq`/`neq`/`gt`/`gte`/`lt`/`lte`/`in`, `order`, `limit` y el header
 * `Accept: application/vnd.pgrst.object+json` que dispara `.single()`.
 */

export type Row = Record<string, unknown>;
export type Db = Record<string, Row[]>;

interface Filter {
  column: string;
  op: string;
  value: string;
}

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function tableNameFromUrl(url: string): string {
  const { pathname } = new URL(url);
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

function parseFilters(searchParams: URLSearchParams): Filter[] {
  const filters: Filter[] = [];
  searchParams.forEach((raw, column) => {
    if (RESERVED_PARAMS.has(column)) return;
    const [op, ...rest] = raw.split('.');
    filters.push({ column, op, value: rest.join('.') });
  });
  return filters;
}

function toComparable(value: unknown): number | string {
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return String(value);
  const asNumber = Number(value);
  return value !== '' && value !== null && value !== undefined && !Number.isNaN(asNumber) ? asNumber : String(value);
}

function orderedCompare(rowValue: unknown, rawValue: string): number {
  const a = toComparable(rowValue);
  const b = toComparable(rawValue);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function matchesFilter(row: Row, filter: Filter): boolean {
  const rowValue = row[filter.column];

  if (filter.op === 'is') {
    return filter.value === 'null' ? rowValue === null || rowValue === undefined : true;
  }
  if (rowValue === undefined || rowValue === null) return false;

  switch (filter.op) {
    case 'eq':
      return String(rowValue) === filter.value;
    case 'neq':
      return String(rowValue) !== filter.value;
    case 'gt':
      return orderedCompare(rowValue, filter.value) > 0;
    case 'gte':
      return orderedCompare(rowValue, filter.value) >= 0;
    case 'lt':
      return orderedCompare(rowValue, filter.value) < 0;
    case 'lte':
      return orderedCompare(rowValue, filter.value) <= 0;
    case 'in': {
      const values = filter.value.replace(/^\(|\)$/g, '').split(',');
      return values.includes(String(rowValue));
    }
    default:
      return true;
  }
}

/**
 * Instala el mock para el resto del test actual. Llamarlo ANTES de
 * cy.visit()/cy.loginAs(), para que el intercept ya esté armado cuando la
 * app dispare sus primeras consultas.
 *
 * El tipo de `seed` es deliberadamente laxo (`unknown[]` por tabla): cada
 * spec arma sus filas con la forma que le interese (fixtures de dominio,
 * objetos ad-hoc) sin tener que satisfacer el índice de `Row`.
 */
export function mockSupabase(seed: Partial<Record<string, unknown[]>> = {}): void {
  const db: Db = {};
  Object.entries(seed).forEach(([table, rows]) => {
    db[table] = ((rows ?? []) as Row[]).map((row) => ({ ...row }));
  });

  cy.intercept('**/rest/v1/**', (req) => {
    const table = tableNameFromUrl(req.url);
    const url = new URL(req.url);
    const filters = parseFilters(url.searchParams);
    db[table] ??= [];

    if (req.method === 'GET') {
      let rows = db[table].filter((row) => filters.every((f) => matchesFilter(row, f)));

      const order = url.searchParams.get('order');
      if (order) {
        const [column, direction] = order.split('.');
        rows = [...rows].sort((a, b) => {
          const cmp = orderedCompare(a[column], String(b[column] ?? ''));
          return direction === 'desc' ? -cmp : cmp;
        });
      }

      const limit = url.searchParams.get('limit');
      if (limit) rows = rows.slice(0, Number(limit));

      const wantsSingle = (req.headers['accept'] as string | undefined)?.includes('vnd.pgrst.object');
      if (wantsSingle) {
        if (rows.length === 1) {
          req.reply({ statusCode: 200, body: rows[0] });
        } else {
          req.reply({ statusCode: 406, body: { message: 'Not found', code: 'PGRST116' } });
        }
        return;
      }

      req.reply({ statusCode: 200, body: rows });
      return;
    }

    if (req.method === 'POST') {
      const incoming = (Array.isArray(req.body) ? req.body : [req.body]) as Row[];
      const inserted = incoming.map((row) => ({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        ...row,
      }));
      db[table].push(...inserted);
      req.reply({ statusCode: 201, body: inserted });
      return;
    }

    if (req.method === 'PATCH') {
      const patch = (req.body ?? {}) as Row;
      db[table] = db[table].map((row) => (filters.every((f) => matchesFilter(row, f)) ? { ...row, ...patch } : row));
      const updated = db[table].filter((row) => filters.every((f) => matchesFilter(row, f)));
      req.reply({ statusCode: 200, body: updated });
      return;
    }

    if (req.method === 'DELETE') {
      const removed = db[table].filter((row) => filters.every((f) => matchesFilter(row, f)));
      db[table] = db[table].filter((row) => !filters.every((f) => matchesFilter(row, f)));
      req.reply({ statusCode: 200, body: removed });
      return;
    }

    req.reply({ statusCode: 200, body: [] });
  }).as('supabaseRest');
}

/** Mockea una Edge Function (`supabase.functions.invoke(name, ...)`). */
export function mockFunction(name: string, response: { statusCode?: number; body?: unknown } = {}): void {
  cy.intercept('POST', `**/functions/v1/${name}`, {
    statusCode: response.statusCode ?? 200,
    body: response.body ?? {},
  }).as(`fn_${name}`);
}
