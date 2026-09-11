import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, Search, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PrintButton } from '../components/PrintButton';
import { QuotePreview } from '../components/QuotePreview';
import { ShareButton } from '../components/ShareButton';
import { WhatsAppWebButton } from '../components/WhatsAppWebButton';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../lib/format';
import type { Client, Product, Profile, Quote, QuoteItem } from '../types';

const statusLabels: Record<Quote['status'], string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  expired: 'Vencido',
  converted: 'Convertido',
};

const statusStyles: Record<Quote['status'], string> = {
  draft: 'bg-gray-500/10 text-gray-500 dark:text-gray-400',
  approved: 'bg-green-500/10 text-green-500',
  expired: 'bg-red-500/10 text-red-500',
  converted: 'bg-orange-500/10 text-orange-500',
};

function quoteSubtotal(items: QuoteItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
}

function quoteTotal(items: QuoteItem[], discountPercent: number): number {
  return quoteSubtotal(items) * (1 - discountPercent / 100);
}

function NewQuoteForm({
  clients,
  products,
  onSaved,
  onCancel,
}: {
  clients: Client[];
  products: Product[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<QuoteItem[]>([
    { product_id: products[0]?.id ?? '', quantity: 1, unit_price: products[0]?.price ?? 0 },
  ]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();
  const { user } = useAuth();

  function updateItem(index: number, patch: Partial<QuoteItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { product_id: products[0]?.id ?? '', quantity: 1, unit_price: products[0]?.price ?? 0 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { error } = await supabase.from('quotes').insert({
      client_id: clientId,
      items,
      valid_until: validUntil || null,
      status: 'draft',
      discount_percent: Number(discountPercent) || 0,
      created_by: user?.id ?? null,
    });

    if (error) {
      setStatus('error');
      setErrorMessage('No se pudo guardar el presupuesto. Verificá tu conexión.');
      return;
    }

    setStatus('saved');
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Cliente</label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Válido hasta</label>
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ítems</label>
        {items.map((item, index) => (
          <div key={index} className="flex gap-2 items-center">
            <select
              value={item.product_id}
              onChange={(e) => {
                const product = products.find((p) => p.id === e.target.value);
                updateItem(index, { product_id: e.target.value, unit_price: product?.price ?? item.unit_price });
              }}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="any"
              value={item.quantity}
              onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
              className="w-24 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
              placeholder="Cant."
            />
            <input
              type="number"
              step="any"
              value={item.unit_price}
              onChange={(e) => updateItem(index, { unit_price: Number(e.target.value) })}
              className="w-28 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
              placeholder="Precio"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              disabled={items.length === 1}
              className="text-gray-500 dark:text-gray-400 hover:text-red-500 disabled:opacity-30"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-sm text-orange-500 hover:text-orange-400">
          + Agregar ítem
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
            Descuento por pago en efectivo (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div className="flex flex-col justify-end text-sm text-gray-500 dark:text-gray-400">
          <p>Subtotal: {formatCurrency(quoteSubtotal(items))}</p>
          <p className="text-gray-900 dark:text-white font-medium">
            Total con descuento: {formatCurrency(quoteTotal(items, Number(discountPercent) || 0))}
          </p>
        </div>
      </div>

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
            disabled={status === 'saving' || !clientId}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Guardar presupuesto
          </button>
        </div>
      </div>
    </form>
  );
}

export function Quotes() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [quotesResult, clientsResult, productsResult, profilesResult] = await Promise.all([
      supabase.from('quotes').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('profiles').select('*'),
    ]);
    setQuotes((quotesResult.data ?? []) as Quote[]);
    setClients((clientsResult.data ?? []) as Client[]);
    setProducts((productsResult.data ?? []) as Product[]);
    setProfiles((profilesResult.data ?? []) as Profile[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    loadData();
  }

  async function updateStatus(quote: Quote, newStatus: Quote['status']) {
    await supabase.from('quotes').update({ status: newStatus }).eq('id', quote.id);
    loadData();
  }

  async function convertQuote(quote: Quote, target: 'stockpile' | 'sale') {
    setConvertingId(quote.id);
    setConvertError(null);

    const { data, error } = await supabase.functions.invoke('convert-quote', {
      body: { quote_id: quote.id, target },
    });

    if (error || (data as { error?: string } | null)?.error) {
      setConvertError((data as { error?: string } | null)?.error ?? 'Error de conexión. Intentá nuevamente.');
      setConvertingId(null);
      return;
    }

    setConvertingId(null);
    loadData();
  }

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  const filteredQuotes = quotes.filter((quote) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const clientName = clientsById[quote.client_id]?.name ?? '';
    return clientName.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Presupuestos</h1>
        <button
          onClick={() => setShowForm(true)}
          disabled={clients.length === 0 || products.length === 0}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
        >
          <Plus size={16} />
          Nuevo presupuesto
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente..."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 pl-9 pr-3 py-2 text-gray-900 dark:text-white"
        />
      </div>

      {convertError && <p className="text-sm text-red-500">{convertError}</p>}

      {previewQuote && (
        <div className="space-y-3">
          <div className="print:hidden flex items-center justify-between">
            <button onClick={() => setPreviewQuote(null)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              ← Volver al listado
            </button>
            <div className="flex gap-3">
              <PrintButton />
              <ShareButton
                targetRef={previewRef}
                fileName={`presupuesto-${previewQuote.id.slice(0, 8)}.pdf`}
                shareTitle="Presupuesto"
              />
              <WhatsAppWebButton
                targetRef={previewRef}
                fileName={`presupuesto-${previewQuote.id.slice(0, 8)}.pdf`}
                phone={clientsById[previewQuote.client_id]?.phone ?? null}
                message="Hola! Te paso el presupuesto."
              />
            </div>
          </div>
          <div ref={previewRef} className="print-area">
            <QuotePreview
              quote={previewQuote}
              client={clientsById[previewQuote.client_id]}
              productsById={productsById}
            />
          </div>
        </div>
      )}

      {!previewQuote && showForm && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Nuevo presupuesto</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          <NewQuoteForm clients={clients} products={products} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {!previewQuote && (
      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Cargando presupuestos...</p>
        ) : quotes.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">No hay presupuestos cargados todavía.</p>
        ) : filteredQuotes.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Ningún presupuesto coincide con la búsqueda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Válido hasta</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Cargado por</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredQuotes.map((quote) => {
                const total = quoteTotal(quote.items, quote.discount_percent);
                return (
                  <tr key={quote.id} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                    <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{clientsById[quote.client_id]?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formatCurrency(total)}
                      {quote.discount_percent > 0 && (
                        <span className="ml-2 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500">
                          -{quote.discount_percent}% efectivo
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('es-AR') : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[quote.status]}`}>
                        {statusLabels[quote.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {quote.created_by ? profilesById[quote.created_by]?.name ?? '—' : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => setPreviewQuote(quote)}
                          className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                          Ver
                        </button>
                        {quote.status === 'draft' && (
                          <button
                            onClick={() => updateStatus(quote, 'approved')}
                            className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                          >
                            Aprobar
                          </button>
                        )}
                        {quote.status === 'approved' && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => convertQuote(quote, 'stockpile')}
                              disabled={convertingId === quote.id}
                              className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                            >
                              Convertir a acopio
                            </button>
                            <button
                              onClick={() => convertQuote(quote, 'sale')}
                              disabled={convertingId === quote.id}
                              className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
                            >
                              Convertir a venta directa
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}
    </div>
  );
}
