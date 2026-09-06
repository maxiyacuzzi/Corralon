import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StockMovementForm } from '../components/StockMovementForm';
import { formatStock } from '../lib/units';
import { movementLabels } from '../lib/stockMovements';
import type { Product, StockMovement } from '../types';

export function Stock() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [productsResult, movementsResult] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('stock_movements').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setProducts((productsResult.data ?? []) as Product[]);
    setMovements((movementsResult.data ?? []) as StockMovement[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    loadData();
  }

  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Stock</h1>
        <button
          onClick={() => setShowForm(true)}
          disabled={products.length === 0}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
        >
          <Plus size={16} />
          Registrar movimiento
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Nuevo movimiento de stock</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <StockMovementForm products={products} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-x-auto">
        <h2 className="px-5 py-4 text-lg font-medium text-white border-b border-gray-700">Historial de movimientos</h2>
        {loading ? (
          <p className="p-5 text-gray-400">Cargando movimientos...</p>
        ) : movements.length === 0 ? (
          <p className="p-5 text-gray-400">No hay movimientos registrados todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Cantidad</th>
                <th className="px-5 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((movement) => {
                const product = productsById[movement.product_id];
                return (
                <tr key={movement.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3 text-white font-medium">
                    {product?.name ?? movement.product_id}
                  </td>
                  <td className="px-5 py-3 text-gray-300">{movementLabels[movement.type]}</td>
                  <td className={`px-5 py-3 ${movement.quantity >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {movement.quantity >= 0 ? '+' : '-'}
                    {product ? formatStock(product, Math.abs(movement.quantity)) : Math.abs(movement.quantity)}
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {new Date(movement.created_at).toLocaleString('es-AR')}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
