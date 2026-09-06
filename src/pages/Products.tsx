import { useEffect, useState } from 'react';
import { Pencil, Plus, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ProductForm } from '../components/ProductForm';
import { formatStock, stockStatus } from '../lib/units';
import type { Category, Product, Stockpile, Supplier } from '../types';

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
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockpiles, setStockpiles] = useState<Pick<Stockpile, 'product_id' | 'total_reserved' | 'total_withdrawn'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const [productsResult, categoriesResult, suppliersResult, stockpilesResult] = await Promise.all([
      supabase.from('products').select('*').order('name'),
      supabase.from('categories').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('stockpiles').select('product_id, total_reserved, total_withdrawn'),
    ]);
    setProducts((productsResult.data ?? []) as Product[]);
    setCategories((categoriesResult.data ?? []) as Category[]);
    setSuppliers((suppliersResult.data ?? []) as Supplier[]);
    setStockpiles(stockpilesResult.data ?? []);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    setEditingProduct(null);
    loadProducts();
  }

  function closeForm() {
    setShowForm(false);
    setEditingProduct(null);
  }

  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const suppliersById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const stockpiledByProductId = stockpiles.reduce<Record<string, number>>((acc, s) => {
    acc[s.product_id] = (acc[s.product_id] ?? 0) + (s.total_reserved - s.total_withdrawn);
    return acc;
  }, {});

  const filteredProducts = products.filter((product) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const categoryName = product.category_id ? categoriesById[product.category_id]?.name ?? '' : '';
    const supplierName = product.supplier_id ? suppliersById[product.supplier_id]?.name ?? '' : '';
    return (
      product.name.toLowerCase().includes(term) ||
      categoryName.toLowerCase().includes(term) ||
      supplierName.toLowerCase().includes(term)
    );
  });

  const isFormOpen = showForm || editingProduct !== null;

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

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por producto, categoría o proveedor..."
          className="w-full rounded-lg border border-gray-700 bg-gray-900 pl-9 pr-3 py-2 text-white"
        />
      </div>

      {isFormOpen && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">
              {editingProduct ? 'Editar producto' : 'Nuevo producto'}
            </h2>
            <button onClick={closeForm} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <ProductForm
            product={editingProduct ?? undefined}
            categories={categories}
            suppliers={suppliers}
            onSaved={handleSaved}
            onCancel={closeForm}
          />
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-400">Cargando productos...</p>
        ) : products.length === 0 ? (
          <p className="p-5 text-gray-400">No hay productos cargados todavía.</p>
        ) : filteredProducts.length === 0 ? (
          <p className="p-5 text-gray-400">Ningún producto coincide con la búsqueda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3">Categoría</th>
                <th className="px-5 py-3">Proveedor</th>
                <th className="px-5 py-3">Stock actual</th>
                <th className="px-5 py-3">Acopiado</th>
                <th className="px-5 py-3">Precio</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => {
                const status = stockStatus(product);
                const stockpiled = stockpiledByProductId[product.id] ?? 0;
                const shortOnStock = stockpiled > product.current_stock;
                return (
                  <tr key={product.id} className="border-b border-gray-800 last:border-0">
                    <td className="px-5 py-3 text-white font-medium">{product.name}</td>
                    <td className="px-5 py-3 text-gray-300">
                      {product.category_id ? categoriesById[product.category_id]?.name ?? '—' : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-300">
                      {product.supplier_id ? suppliersById[product.supplier_id]?.name ?? '—' : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-300">{formatStock(product, product.current_stock)}</td>
                    <td className={`px-5 py-3 ${shortOnStock ? 'text-red-500 font-medium' : 'text-gray-300'}`}>
                      {stockpiled > 0 ? formatStock(product, stockpiled) : '—'}
                      {shortOnStock && <span className="ml-1 text-xs">(falta stock)</span>}
                    </td>
                    <td className="px-5 py-3 text-gray-300">${product.price.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}>
                        {statusLabels[status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="flex items-center gap-1.5 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 ml-auto"
                      >
                        <Pencil size={14} />
                        Editar
                      </button>
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
