import { useEffect, useState } from 'react';
import { Package, AlertTriangle, Boxes, TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StatCard } from '../components/StatCard';
import type { DeliveryNote, Stats, StockMovement } from '../types';

export function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [recentDeliveryNotes, setRecentDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [productsResult, stockpilesResult, salesResult, movementsResult, deliveryNotesResult] = await Promise.all([
      supabase.from('products').select('id, current_stock, min_stock_alert'),
      supabase.from('stockpiles').select('id, total_reserved, total_withdrawn'),
      supabase.from('sales').select('id').gte('created_at', startOfMonth.toISOString()),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(5),
      supabase.from('delivery_notes').select('*').order('created_at', { ascending: false }).limit(5),
    ]);

    const products = productsResult.data ?? [];
    const stockpiles = stockpilesResult.data ?? [];

    setStats({
      total_products: products.length,
      low_stock_count: products.filter((p) => p.current_stock <= p.min_stock_alert).length,
      active_stockpiles: stockpiles.filter((s) => s.total_reserved - s.total_withdrawn > 0).length,
      sales_this_month: salesResult.data?.length ?? 0,
    });

    setRecentMovements((movementsResult.data ?? []) as StockMovement[]);
    setRecentDeliveryNotes((deliveryNotesResult.data ?? []) as DeliveryNote[]);
    setLoading(false);
  }

  if (loading || !stats) {
    return <p className="text-gray-400">Cargando dashboard...</p>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-white">Dashboard</h1>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h2 className="text-lg font-medium text-white mb-4">Últimos movimientos de stock</h2>
          {recentMovements.length === 0 ? (
            <p className="text-sm text-gray-400">Sin movimientos registrados.</p>
          ) : (
            <ul className="space-y-3">
              {recentMovements.map((movement) => (
                <li key={movement.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{movement.type}</span>
                  <span className={movement.quantity >= 0 ? 'text-green-500' : 'text-red-500'}>
                    {movement.quantity >= 0 ? '+' : ''}
                    {movement.quantity}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
          <h2 className="text-lg font-medium text-white mb-4">Últimos remitos generados</h2>
          {recentDeliveryNotes.length === 0 ? (
            <p className="text-sm text-gray-400">Sin remitos generados.</p>
          ) : (
            <ul className="space-y-3">
              {recentDeliveryNotes.map((note) => (
                <li key={note.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">Remito N.º {String(note.number).padStart(6, '0')}</span>
                  <span className="text-gray-400">{new Date(note.created_at).toLocaleDateString('es-AR')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
