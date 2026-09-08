import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package, AlertTriangle, Boxes, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StatCard } from '../components/StatCard';
import { SalesChart } from '../components/SalesChart';
import { formatStock } from '../lib/units';
import { formatCurrency } from '../lib/format';
import { movementLabels } from '../lib/stockMovements';
import type { DeliveryNote, OwnCheck, Product, Stats, StockMovement } from '../types';

const SALES_CHART_DAYS = 30;

function toDateKey(date: Date) {
  return date.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

function buildDailySales(sales: { created_at: string; total_amount: number }[], days: number) {
  const buckets = new Map<string, number>();
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    buckets.set(toDateKey(day), 0);
  }

  for (const sale of sales) {
    const key = toDateKey(new Date(sale.created_at));
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + sale.total_amount);
    }
  }

  return Array.from(buckets.entries()).map(([date, total]) => ({ date, total }));
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [recentDeliveryNotes, setRecentDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesChartData, setSalesChartData] = useState<{ date: string; total: number }[]>([]);
  const [pendingOwnChecks, setPendingOwnChecks] = useState<OwnCheck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const chartStart = new Date();
    chartStart.setDate(chartStart.getDate() - (SALES_CHART_DAYS - 1));
    chartStart.setHours(0, 0, 0, 0);

    const [productsResult, stockpilesResult, salesResult, movementsResult, deliveryNotesResult, dailySalesResult, ownChecksResult] =
      await Promise.all([
        supabase.from('products').select('*'),
        supabase.from('stockpiles').select('id, total_reserved, total_withdrawn'),
        supabase.from('sales').select('id').gte('created_at', startOfMonth.toISOString()),
        supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('delivery_notes').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('sales').select('created_at, total_amount').gte('created_at', chartStart.toISOString()),
        supabase.from('own_checks').select('*').eq('status', 'pending').order('due_date', { ascending: true }),
      ]);

    const productsData = (productsResult.data ?? []) as Product[];
    const stockpiles = stockpilesResult.data ?? [];

    setStats({
      total_products: productsData.length,
      low_stock_count: productsData.filter((p) => p.current_stock <= p.min_stock_alert).length,
      active_stockpiles: stockpiles.filter((s) => s.total_reserved - s.total_withdrawn > 0).length,
      sales_this_month: salesResult.data?.length ?? 0,
    });

    setProducts(productsData);
    setRecentMovements((movementsResult.data ?? []) as StockMovement[]);
    setRecentDeliveryNotes((deliveryNotesResult.data ?? []) as DeliveryNote[]);
    setSalesChartData(buildDailySales(dailySalesResult.data ?? [], SALES_CHART_DAYS));
    setPendingOwnChecks((ownChecksResult.data ?? []) as OwnCheck[]);
    setLoading(false);
  }

  if (loading || !stats) {
    return <p className="text-gray-500 dark:text-gray-400">Cargando dashboard...</p>;
  }

  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

  const todayKey = toDateKey(new Date());
  const overdueOwnChecks = pendingOwnChecks.filter((check) => check.due_date < todayKey);
  const ownChecksDueToday = pendingOwnChecks.filter((check) => check.due_date === todayKey);
  const urgentOwnChecks = [...overdueOwnChecks, ...ownChecksDueToday];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>

      {urgentOwnChecks.length > 0 && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-red-500" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Cheques propios a cubrir</h2>
          </div>
          <ul className="space-y-2 mb-3">
            {urgentOwnChecks.map((check) => (
              <li key={check.id} className="flex items-center justify-between text-sm gap-3">
                <span className="text-gray-700 dark:text-gray-200 truncate">
                  {check.payee}
                  <span className="text-gray-500 dark:text-gray-400"> — {check.bank} N.º {check.check_number}</span>
                </span>
                <span className={`whitespace-nowrap font-medium ${check.due_date < todayKey ? 'text-red-400' : 'text-yellow-500'}`}>
                  {formatCurrency(check.amount)} · {check.due_date < todayKey ? 'Vencido' : 'Vence hoy'}
                </span>
              </li>
            ))}
          </ul>
          <Link to="/valores?tab=emitidos" className="text-sm font-medium text-orange-500 hover:text-orange-400">
            Ver en Valores →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total de productos" value={stats.total_products} icon={Package} />
        <StatCard
          label="Stock bajo"
          value={stats.low_stock_count}
          icon={AlertTriangle}
          tone={stats.low_stock_count > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Acopios activos" value={stats.active_stockpiles} icon={Boxes} />
        <StatCard label="Ventas del mes" value={stats.sales_this_month} icon={TrendingUp} />
      </div>

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <SalesChart data={salesChartData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Últimos movimientos de stock</h2>
          {recentMovements.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sin movimientos registrados.</p>
          ) : (
            <ul className="space-y-3">
              {recentMovements.map((movement) => {
                const product = productsById[movement.product_id];
                return (
                <li key={movement.id} className="flex items-center justify-between text-sm gap-3">
                  <span className="text-gray-600 dark:text-gray-300 truncate">
                    {product?.name ?? 'Producto eliminado'}
                    <span className="text-gray-400 dark:text-gray-500"> — {movementLabels[movement.type]}</span>
                  </span>
                  <span className={`whitespace-nowrap ${movement.quantity >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {movement.quantity >= 0 ? '+' : '-'}
                    {product ? formatStock(product, Math.abs(movement.quantity)) : Math.abs(movement.quantity)}
                  </span>
                </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Últimos remitos generados</h2>
          {recentDeliveryNotes.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sin remitos generados.</p>
          ) : (
            <ul className="space-y-3">
              {recentDeliveryNotes.map((note) => (
                <li key={note.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Remito N.º {String(note.number).padStart(6, '0')}</span>
                  <span className="text-gray-500 dark:text-gray-400">{new Date(note.created_at).toLocaleDateString('es-AR')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
