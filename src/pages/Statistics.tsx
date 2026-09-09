import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PrintButton } from '../components/PrintButton';
import { formatCurrency } from '../lib/format';
import { categoryFullName } from '../lib/categories';
import type { Category, Client, Product, Sale, StockMovement } from '../types';

type ReportKey = 'top-products' | 'by-category' | 'top-clients' | 'debts';

const reportLabels: Record<ReportKey, string> = {
  'top-products': 'Productos más vendidos',
  'by-category': 'Ventas por categoría',
  'top-clients': 'Top clientes',
  debts: 'Deuda de clientes',
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return isoDate(date);
}

export function Statistics() {
  const [report, setReport] = useState<ReportKey>('top-products');
  const [fromDate, setFromDate] = useState(daysAgo(30));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [salesResult, movementsResult, productsResult, categoriesResult, clientsResult] = await Promise.all([
      supabase.from('sales').select('*'),
      supabase.from('stock_movements').select('*').in('type', ['sale_out', 'stockpile_out']),
      supabase.from('products').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('clients').select('*').order('account_balance', { ascending: false }),
    ]);
    setSales((salesResult.data ?? []) as Sale[]);
    setMovements((movementsResult.data ?? []) as StockMovement[]);
    setProducts((productsResult.data ?? []) as Product[]);
    setCategories((categoriesResult.data ?? []) as Category[]);
    setClients((clientsResult.data ?? []) as Client[]);
    setLoading(false);
  }

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Cargando estadísticas...</p>;
  }

  const rangeStart = new Date(`${fromDate}T00:00:00`);
  const rangeEnd = new Date(`${toDate}T23:59:59.999`);
  const inRange = (dateStr: string) => {
    const date = new Date(dateStr);
    return date >= rangeStart && date <= rangeEnd;
  };

  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));

  const movementsInRange = movements.filter((m) => inRange(m.created_at));
  const salesInRange = sales.filter((s) => inRange(s.created_at));

  // Productos más vendidos: cantidad movida por ventas/retiros de acopio en el período.
  const productQuantities = new Map<string, number>();
  for (const movement of movementsInRange) {
    productQuantities.set(movement.product_id, (productQuantities.get(movement.product_id) ?? 0) + Math.abs(movement.quantity));
  }
  const topProducts = [...productQuantities.entries()]
    .map(([productId, quantity]) => {
      const product = productsById[productId];
      return {
        productId,
        name: product?.name ?? 'Producto eliminado',
        unit: product?.retail_unit ?? '',
        quantity,
        // Estimado al precio actual: el movimiento de stock no guarda el precio histórico.
        estimatedRevenue: quantity * (product?.price ?? 0),
      };
    })
    .sort((a, b) => b.quantity - a.quantity);

  // Ventas por categoría: mismo movimiento de stock, agrupado por la categoría del producto.
  const categoryTotals = new Map<string, { quantity: number; revenue: number }>();
  for (const movement of movementsInRange) {
    const product = productsById[movement.product_id];
    const categoryId = product?.category_id ?? 'none';
    const current = categoryTotals.get(categoryId) ?? { quantity: 0, revenue: 0 };
    current.quantity += Math.abs(movement.quantity);
    current.revenue += Math.abs(movement.quantity) * (product?.price ?? 0);
    categoryTotals.set(categoryId, current);
  }
  const categoryRows = [...categoryTotals.entries()]
    .map(([categoryId, totals]) => ({
      categoryId,
      name:
        categoryId === 'none'
          ? 'Sin categoría'
          : categoriesById[categoryId]
            ? categoryFullName(categoriesById[categoryId], categoriesById)
            : 'Categoría eliminada',
      ...totals,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  // Top clientes: facturación real (sales.total_amount) en el período.
  const clientTotals = new Map<string, { amount: number; count: number }>();
  for (const sale of salesInRange) {
    const current = clientTotals.get(sale.client_id) ?? { amount: 0, count: 0 };
    current.amount += sale.total_amount;
    current.count += 1;
    clientTotals.set(sale.client_id, current);
  }
  const topClients = [...clientTotals.entries()]
    .map(([clientId, totals]) => ({ clientId, name: clientsById[clientId]?.name ?? 'Cliente eliminado', ...totals }))
    .sort((a, b) => b.amount - a.amount);

  // Deuda de clientes: es una foto de la cuenta corriente actual, no depende del rango de fechas.
  const debtors = clients.filter((client) => client.account_balance > 0).sort((a, b) => b.account_balance - a.account_balance);
  const totalDebt = debtors.reduce((sum, client) => sum + client.account_balance, 0);

  const showDateRange = report !== 'debts';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white print:hidden">Estadísticas</h1>

      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div className="inline-flex flex-wrap rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-1 gap-1">
          {(Object.keys(reportLabels) as ReportKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setReport(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                report === key
                  ? 'bg-orange-600 text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {reportLabels[key]}
            </button>
          ))}
        </div>

        {showDateRange && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <label htmlFor="stats-from">Desde</label>
            <input
              id="stats-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 text-gray-900 dark:text-white"
            />
            <label htmlFor="stats-to">Hasta</label>
            <input
              id="stats-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-2 py-1.5 text-gray-900 dark:text-white"
            />
          </div>
        )}
      </div>

      <div className="print-area rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">{reportLabels[report]}</h2>
            {showDateRange && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {new Date(fromDate).toLocaleDateString('es-AR')} — {new Date(toDate).toLocaleDateString('es-AR')}
              </p>
            )}
          </div>
          <PrintButton />
        </div>

        {report === 'top-products' &&
          (topProducts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sin ventas registradas en este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                    <th className="py-2 pr-4">Producto</th>
                    <th className="py-2 pr-4">Cantidad vendida</th>
                    <th className="py-2">Facturación estimada</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((row) => (
                    <tr key={row.productId} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-gray-900 dark:text-white font-medium">{row.name}</td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">
                        {row.quantity.toLocaleString('es-AR')} {row.unit}
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-300">{formatCurrency(row.estimatedRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {report === 'by-category' &&
          (categoryRows.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sin ventas registradas en este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                    <th className="py-2 pr-4">Categoría</th>
                    <th className="py-2 pr-4">Cantidad vendida</th>
                    <th className="py-2">Facturación estimada</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map((row) => (
                    <tr key={row.categoryId} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-gray-900 dark:text-white font-medium">{row.name}</td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{row.quantity.toLocaleString('es-AR')}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-300">{formatCurrency(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {report === 'top-clients' &&
          (topClients.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sin ventas registradas en este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                    <th className="py-2 pr-4">Cliente</th>
                    <th className="py-2 pr-4">Cantidad de ventas</th>
                    <th className="py-2">Facturado</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((row) => (
                    <tr key={row.clientId} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-gray-900 dark:text-white font-medium">{row.name}</td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{row.count}</td>
                      <td className="py-2 text-gray-600 dark:text-gray-300">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

        {report === 'debts' &&
          (debtors.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Ningún cliente tiene saldo pendiente.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                    <th className="py-2 pr-4">Cliente</th>
                    <th className="py-2">Debe</th>
                  </tr>
                </thead>
                <tbody>
                  {debtors.map((client) => (
                    <tr key={client.id} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-gray-900 dark:text-white font-medium">{client.name}</td>
                      <td className="py-2 text-red-500 font-medium">{formatCurrency(client.account_balance)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white font-semibold">Total</td>
                    <td className="py-2 text-red-500 font-semibold">{formatCurrency(totalDebt)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </div>
  );
}
