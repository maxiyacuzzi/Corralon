import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { Plus, X, PackageMinus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StockpileWithdrawForm } from '../components/StockpileWithdrawForm';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import type { Client, Product, Stockpile, StockMovement } from '../types';

interface NewStockpileFormProps {
  clients: Client[];
  products: Product[];
  onSaved: () => void;
  onCancel: () => void;
}

function NewStockpileForm({ clients, products, onSaved, onCancel }: NewStockpileFormProps) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [totalReserved, setTotalReserved] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { error } = await supabase.from('stockpiles').insert({
      client_id: clientId,
      product_id: productId,
      total_reserved: Number(totalReserved),
      total_withdrawn: 0,
    });

    if (error) {
      setStatus('error');
      setErrorMessage('No se pudo crear el acopio. Verificá tu conexión.');
      return;
    }

    setStatus('saved');
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Cliente</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Producto</label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Cantidad reservada</label>
        <input
          required
          type="number"
          step="any"
          value={totalReserved}
          onChange={(e) => setTotalReserved(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <SaveStatusIndicator status={status} errorMessage={errorMessage} />
        <div className="flex gap-3 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={status === 'saving' || !clientId || !productId}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Crear acopio
          </button>
        </div>
      </div>
    </form>
  );
}

export function Stockpiles() {
  const [stockpiles, setStockpiles] = useState<Stockpile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [withdrawals, setWithdrawals] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<Stockpile | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [stockpilesResult, clientsResult, productsResult, withdrawalsResult] = await Promise.all([
      supabase.from('stockpiles').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('stock_movements').select('*').eq('type', 'stockpile_out').order('created_at', { ascending: false }),
    ]);

    const rawStockpiles = (stockpilesResult.data ?? []) as Omit<Stockpile, 'remaining'>[];
    setStockpiles(rawStockpiles.map((s) => ({ ...s, remaining: s.total_reserved - s.total_withdrawn })));
    setClients((clientsResult.data ?? []) as Client[]);
    setProducts((productsResult.data ?? []) as Product[]);
    setWithdrawals((withdrawalsResult.data ?? []) as StockMovement[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    loadData();
  }

  function handleWithdrawSaved() {
    setWithdrawTarget(null);
    loadData();
  }

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Acopios</h1>
        <button
          onClick={() => setShowForm(true)}
          disabled={clients.length === 0 || products.length === 0}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
        >
          <Plus size={16} />
          Nuevo acopio
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Nuevo acopio</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <NewStockpileForm clients={clients} products={products} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {withdrawTarget && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">
              Retirar de acopio — {clientsById[withdrawTarget.client_id]?.name}
            </h2>
            <button onClick={() => setWithdrawTarget(null)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <StockpileWithdrawForm
            stockpile={withdrawTarget}
            product={productsById[withdrawTarget.product_id]}
            onSaved={handleWithdrawSaved}
            onCancel={() => setWithdrawTarget(null)}
          />
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-400">Cargando acopios...</p>
        ) : stockpiles.length === 0 ? (
          <p className="p-5 text-gray-400">No hay acopios cargados todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3">Reservado</th>
                <th className="px-5 py-3">Retirado</th>
                <th className="px-5 py-3">Saldo restante</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {stockpiles.map((stockpile) => (
                <Fragment key={stockpile.id}>
                  <tr
                    className="border-b border-gray-800 last:border-0 cursor-pointer hover:bg-gray-800/60"
                    onClick={() => setExpandedId(expandedId === stockpile.id ? null : stockpile.id)}
                  >
                    <td className="px-5 py-3 text-white font-medium">{clientsById[stockpile.client_id]?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-300">{productsById[stockpile.product_id]?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-300">{stockpile.total_reserved}</td>
                    <td className="px-5 py-3 text-gray-300">{stockpile.total_withdrawn}</td>
                    <td className="px-5 py-3 text-white font-medium">
                      {stockpile.remaining} {productsById[stockpile.product_id]?.retail_unit}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setWithdrawTarget(stockpile);
                        }}
                        disabled={stockpile.remaining <= 0}
                        className="flex items-center gap-1.5 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-40 ml-auto"
                      >
                        <PackageMinus size={14} />
                        Retirar
                      </button>
                    </td>
                  </tr>
                  {expandedId === stockpile.id && (
                    <tr className="bg-gray-900/40">
                      <td colSpan={6} className="px-5 py-4">
                        <p className="text-sm text-gray-400 mb-2">Historial de retiros</p>
                        {withdrawals.filter((w) => w.reference_id === stockpile.id).length === 0 ? (
                          <p className="text-sm text-gray-500">Sin retiros registrados.</p>
                        ) : (
                          <ul className="space-y-1">
                            {withdrawals
                              .filter((w) => w.reference_id === stockpile.id)
                              .map((w) => (
                                <li key={w.id} className="flex justify-between text-sm text-gray-300">
                                  <span>{new Date(w.created_at).toLocaleString('es-AR')}</span>
                                  <span>{Math.abs(w.quantity)} {productsById[stockpile.product_id]?.retail_unit}</span>
                                </li>
                              ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
