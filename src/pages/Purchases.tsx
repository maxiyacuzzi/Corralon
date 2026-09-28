import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { paymentLabels } from '../lib/payments';
import { formatCurrency, formatDateOnly } from '../lib/format';
import { bulkToRetail } from '../lib/units';
import type { PaymentMethod, Product, Purchase, PurchaseItem, Supplier } from '../types';

// Cantidad y costo como texto mientras se editan, para poder borrar el campo sin que vuelva a 0.
interface ItemState {
  product_id: string;
  quantity: string;
  unit: PurchaseItem['unit'];
  unit_cost: string;
}

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function unitName(product: Product | undefined, unit: PurchaseItem['unit']): string {
  if (!product) return '';
  return unit === 'bulk' ? product.bulk_unit : product.retail_unit;
}

function NewPurchaseForm({
  suppliers,
  products,
  onSaved,
  onCancel,
}: {
  suppliers: Supplier[];
  products: Product[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [purchaseDate, setPurchaseDate] = useState(todayLocal);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [items, setItems] = useState<ItemState[]>([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
  // Primero los productos que tienen cargado a este proveedor, después el resto.
  const sortedProducts = [...products].sort(
    (a, b) => Number(b.supplier_id === supplierId) - Number(a.supplier_id === supplierId) || a.name.localeCompare(b.name),
  );
  const validItems = items
    .map((item) => {
      const product = productsById[item.product_id];
      return {
        product_id: item.product_id,
        quantity: Number(item.quantity) || 0,
        // Si el producto tiene una sola unidad, se carga directo en retail_unit.
        unit: product && product.bulk_unit === product.retail_unit ? ('retail' as const) : item.unit,
        unit_cost: Number(item.unit_cost) || 0,
      };
    })
    .filter((item) => item.product_id && item.quantity > 0);
  const total = validItems.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

  function updateItem(index: number, patch: Partial<ItemState>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    const first = sortedProducts[0];
    setItems((prev) => [...prev, { product_id: first?.id ?? '', quantity: '1', unit: 'bulk', unit_cost: '' }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { data, error } = await supabase.functions.invoke('register-purchase', {
      body: {
        supplier_id: supplierId,
        purchase_date: purchaseDate,
        payment_method: paymentMethod,
        items: validItems,
        notes: notes || null,
      },
    });

    if (error || (data as { error?: string } | null)?.error) {
      setStatus('error');
      setErrorMessage((data as { error?: string } | null)?.error ?? 'Error de conexión. Intentá nuevamente.');
      return;
    }

    setStatus('saved');
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Proveedor</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          >
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Fecha de compra</label>
          <input
            required
            type="date"
            value={purchaseDate}
            onChange={(e) => setPurchaseDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Forma de pago</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          >
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="checks">Valores</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Productos</label>
        {items.map((item, index) => {
          const product = productsById[item.product_id];
          const hasTwoUnits = !!product && product.bulk_unit !== product.retail_unit;
          const quantity = Number(item.quantity) || 0;
          const unitCost = Number(item.unit_cost) || 0;
          return (
            <div key={index} className="space-y-1">
              <div className="flex gap-2 items-center">
                <select
                  value={item.product_id}
                  onChange={(e) => updateItem(index, { product_id: e.target.value, unit: 'bulk' })}
                  className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                >
                  {sortedProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={item.quantity}
                  onChange={(e) => updateItem(index, { quantity: e.target.value })}
                  className="w-24 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                  placeholder="Cant."
                />
                {hasTwoUnits ? (
                  <select
                    value={item.unit}
                    onChange={(e) => updateItem(index, { unit: e.target.value as PurchaseItem['unit'] })}
                    className="w-28 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                  >
                    <option value="bulk">{product.bulk_unit}</option>
                    <option value="retail">{product.retail_unit}</option>
                  </select>
                ) : (
                  <span className="w-28 text-sm text-gray-500 dark:text-gray-400">{product?.retail_unit}</span>
                )}
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={item.unit_cost}
                  onChange={(e) => updateItem(index, { unit_cost: e.target.value })}
                  className="w-32 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                  placeholder="Costo unit."
                  aria-label="Costo unitario"
                />
                <button type="button" onClick={() => removeItem(index)} className="text-gray-500 dark:text-gray-400 hover:text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
              {product && quantity > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Suma al stock:{' '}
                  {(item.unit === 'bulk' && hasTwoUnits ? bulkToRetail(product, quantity) : quantity).toLocaleString('es-AR')}{' '}
                  {product.retail_unit} — subtotal {formatCurrency(quantity * unitCost)}
                  {hasTwoUnits && ` (costo por ${unitName(product, item.unit)})`}
                </p>
              )}
            </div>
          );
        })}
        <button type="button" onClick={addItem} disabled={products.length === 0} className="text-sm text-orange-500 hover:text-orange-400 disabled:opacity-50">
          + Agregar producto
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Notas (opcional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          placeholder="Ej: N.º de factura del proveedor"
        />
      </div>

      <p className="text-right text-gray-900 dark:text-white font-medium">Total: {formatCurrency(total)}</p>

      <div className="flex items-center justify-between pt-2">
        <SaveStatusIndicator status={status} errorMessage={errorMessage} />
        <div className="flex gap-3 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={status === 'saving' || !supplierId || validItems.length === 0}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Registrar compra
          </button>
        </div>
      </div>
    </form>
  );
}

export function Purchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [purchasesResult, suppliersResult, productsResult] = await Promise.all([
      supabase.from('purchases').select('*').order('purchase_date', { ascending: false }),
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
    ]);
    setPurchases((purchasesResult.data ?? []) as Purchase[]);
    setSuppliers((suppliersResult.data ?? []) as Supplier[]);
    setProducts((productsResult.data ?? []) as Product[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    loadData();
  }

  const suppliersById = Object.fromEntries(suppliers.map((s) => [s.id, s]));
  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

  const filteredPurchases = purchases.filter((purchase) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const supplierName = suppliersById[purchase.supplier_id]?.name ?? '';
    const productNames = purchase.items.map((item) => productsById[item.product_id]?.name ?? '');
    return supplierName.toLowerCase().includes(term) || productNames.some((name) => name.toLowerCase().includes(term));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Compras</h1>
        <button
          onClick={() => setShowForm(true)}
          disabled={suppliers.length === 0}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
        >
          <Plus size={16} />
          Nueva compra
        </button>
      </div>

      {!loading && suppliers.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">Primero cargá al menos un proveedor en la sección Proveedores.</p>
      )}

      {showForm && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Nueva compra</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          <NewPurchaseForm suppliers={suppliers} products={products} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por proveedor o producto..."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 pl-9 pr-3 py-2 text-gray-900 dark:text-white"
        />
      </div>

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Cargando compras...</p>
        ) : purchases.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">No hay compras registradas todavía.</p>
        ) : filteredPurchases.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Ninguna compra coincide con la búsqueda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Proveedor</th>
                <th className="px-5 py-3">Productos</th>
                <th className="px-5 py-3">Forma de pago</th>
                <th className="px-5 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredPurchases.map((purchase) => (
                <tr key={purchase.id} className="border-b border-gray-200 dark:border-gray-800 last:border-0 align-top">
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatDateOnly(purchase.purchase_date)}</td>
                  <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">
                    {suppliersById[purchase.supplier_id]?.name ?? '—'}
                    {purchase.notes && <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{purchase.notes}</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                    {purchase.items.map((item, index) => {
                      const product = productsById[item.product_id];
                      return (
                        <span key={index} className="block">
                          {item.quantity.toLocaleString('es-AR')} {unitName(product, item.unit)} {product?.name ?? 'Producto eliminado'} ×{' '}
                          {formatCurrency(item.unit_cost)}
                        </span>
                      );
                    })}
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{paymentLabels[purchase.payment_method]}</td>
                  <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{formatCurrency(purchase.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
