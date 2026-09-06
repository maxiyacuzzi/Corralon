import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductForm } from '../components/ProductForm';
import { formatStock, stockStatus } from '../lib/units';
import type { Product } from '../types';

const statusStyles: Record<ReturnType<typeof stockStatus>, string> = {
  ok: 'bg-green-500/10 text-green-500',
  low: 'bg-yellow-500/10 text-yellow-500',
  empty: 'bg-red-500/10 text-red-500',
};

const statusLabels: Record<ReturnType<typeof stockStatus>, string> = {
  ok: 'Stock OK',
  low: 'Stock bajo',
  empty: 'Sin stock',
};

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase.from('products').select('*').order('name');
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    loadProducts();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Productos</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
        >
          <Plus size={16} />
          Nuevo producto
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Nuevo producto</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <ProductForm onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-400">Cargando productos...</p>
        ) : products.length === 0 ? (
          <p className="p-5 text-gray-400">No hay productos cargados todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3">Stock actual</th>
                <th className="px-5 py-3">Precio</th>
                <th className="px-5 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const status = stockStatus(product);
                return (
                  <tr key={product.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-5 py-3 text-white font-medium">{product.name}</td>
                    <td className="px-5 py-3 text-gray-300">{formatStock(product, product.current_stock)}</td>
                    <td className="px-5 py-3 text-gray-300">${product.price.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}>
                        {statusLabels[status]}
                      </span>
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
