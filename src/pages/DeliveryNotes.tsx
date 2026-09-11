import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, Search, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DeliveryNotePreview } from '../components/DeliveryNotePreview';
import { PrintButton } from '../components/PrintButton';
import { ShareButton } from '../components/ShareButton';
import { WhatsAppWebButton } from '../components/WhatsAppWebButton';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import type { Client, ClientWorkAddress, DeliveryNote, DeliveryNoteItem, Product, SaleDeliveryNote, Stockpile } from '../types';

function NewDeliveryNoteForm({
  clients,
  products,
  stockpiles,
  workAddresses,
  onSaved,
  onCancel,
}: {
  clients: Client[];
  products: Product[];
  stockpiles: Stockpile[];
  workAddresses: ClientWorkAddress[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [stockpileId, setStockpileId] = useState<string>('');
  const [addressChoice, setAddressChoice] = useState<string>('');
  const [items, setItems] = useState<DeliveryNoteItem[]>([{ product_id: products[0]?.id ?? '', quantity: 1 }]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  const selectedClient = clients.find((c) => c.id === clientId);
  const clientStockpiles = stockpiles.filter((s) => s.client_id === clientId && s.remaining > 0);
  const clientWorkAddresses = workAddresses.filter((w) => w.client_id === clientId);

  function updateItem(index: number, patch: Partial<DeliveryNoteItem>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { product_id: products[0]?.id ?? '', quantity: 1 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const deliveryAddress =
      addressChoice === '' ? (selectedClient?.address ?? null) : (clientWorkAddresses.find((w) => w.id === addressChoice)?.address ?? null);

    const { data, error } = await supabase.functions.invoke('generate-delivery-note', {
      body: {
        client_id: clientId,
        stockpile_id: stockpileId || null,
        items,
        delivery_address: deliveryAddress,
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Cliente</label>
          <select
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setStockpileId('');
              setAddressChoice('');
            }}
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
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Contra acopio (opcional)</label>
          <select
            value={stockpileId}
            onChange={(e) => setStockpileId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          >
            <option value="">Venta directa</option>
            {clientStockpiles.map((stockpile) => (
              <option key={stockpile.id} value={stockpile.id}>
                {products.find((p) => p.id === stockpile.product_id)?.name} — saldo {stockpile.remaining}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Dirección de entrega</label>
        <select
          value={addressChoice}
          onChange={(e) => setAddressChoice(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
        >
          <option value="">
            Domicilio del cliente{selectedClient?.address ? ` (${selectedClient.address})` : ' (sin domicilio cargado)'}
          </option>
          {clientWorkAddresses.map((workAddress) => (
            <option key={workAddress.id} value={workAddress.id}>
              {workAddress.label} ({workAddress.address})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Ítems</label>
        {items.map((item, index) => (
          <div key={index} className="flex gap-2 items-center">
            <select
              value={item.product_id}
              onChange={(e) => updateItem(index, { product_id: e.target.value })}
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
            Generar remito
          </button>
        </div>
      </div>
    </form>
  );
}

export function DeliveryNotes() {
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockpiles, setStockpiles] = useState<Stockpile[]>([]);
  const [workAddresses, setWorkAddresses] = useState<ClientWorkAddress[]>([]);
  const [saleDeliveryNotes, setSaleDeliveryNotes] = useState<SaleDeliveryNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [previewNote, setPreviewNote] = useState<DeliveryNote | null>(null);
  const [search, setSearch] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [notesResult, clientsResult, productsResult, stockpilesResult, linksResult, workAddressesResult] = await Promise.all([
      supabase.from('delivery_notes').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('products').select('*').order('name'),
      supabase.from('stockpiles').select('*'),
      supabase.from('sale_delivery_notes').select('*'),
      supabase.from('client_work_addresses').select('*'),
    ]);
    setDeliveryNotes((notesResult.data ?? []) as DeliveryNote[]);
    setClients((clientsResult.data ?? []) as Client[]);
    setProducts((productsResult.data ?? []) as Product[]);
    const rawStockpiles = (stockpilesResult.data ?? []) as Omit<Stockpile, 'remaining'>[];
    setStockpiles(rawStockpiles.map((s) => ({ ...s, remaining: s.total_reserved - s.total_withdrawn })));
    setSaleDeliveryNotes((linksResult.data ?? []) as SaleDeliveryNote[]);
    setWorkAddresses((workAddressesResult.data ?? []) as ClientWorkAddress[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    loadData();
  }

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
  const linkedNoteIds = new Set(saleDeliveryNotes.map((link) => link.delivery_note_id));

  const filteredNotes = deliveryNotes.filter((note) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const clientName = clientsById[note.client_id]?.name ?? '';
    return clientName.toLowerCase().includes(term) || String(note.number).padStart(6, '0').includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Remitos</h1>
        <button
          onClick={() => setShowForm(true)}
          disabled={clients.length === 0 || products.length === 0}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
        >
          <Plus size={16} />
          Nuevo remito
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente o N.º de remito..."
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 pl-9 pr-3 py-2 text-gray-900 dark:text-white"
        />
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Nuevo remito</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          <NewDeliveryNoteForm
            clients={clients}
            products={products}
            stockpiles={stockpiles}
            workAddresses={workAddresses}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {previewNote && (
        <div className="space-y-3">
          <div className="print:hidden flex items-center justify-between">
            <button onClick={() => setPreviewNote(null)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              ← Volver al listado
            </button>
            <div className="flex gap-3">
              <PrintButton />
              <ShareButton
                targetRef={previewRef}
                fileName={`remito-${String(previewNote.number).padStart(6, '0')}.pdf`}
                shareTitle={`Remito N.º ${String(previewNote.number).padStart(6, '0')}`}
              />
              <WhatsAppWebButton
                targetRef={previewRef}
                fileName={`remito-${String(previewNote.number).padStart(6, '0')}.pdf`}
                phone={clientsById[previewNote.client_id]?.phone ?? null}
                message={`Hola! Te paso el remito N.º ${String(previewNote.number).padStart(6, '0')}.`}
              />
            </div>
          </div>
          <div ref={previewRef} className="print-area">
            <DeliveryNotePreview
              deliveryNote={previewNote}
              client={clientsById[previewNote.client_id]}
              productsById={productsById}
            />
          </div>
        </div>
      )}

      {!previewNote && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
          {loading ? (
            <p className="p-5 text-gray-500 dark:text-gray-400">Cargando remitos...</p>
          ) : deliveryNotes.length === 0 ? (
            <p className="p-5 text-gray-500 dark:text-gray-400">No hay remitos generados todavía.</p>
          ) : filteredNotes.length === 0 ? (
            <p className="p-5 text-gray-500 dark:text-gray-400">Ningún remito coincide con la búsqueda.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                  <th className="px-5 py-3">N.º</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Facturación</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filteredNotes.map((note) => (
                  <tr key={note.id} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                    <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{String(note.number).padStart(6, '0')}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{clientsById[note.client_id]?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{new Date(note.created_at).toLocaleDateString('es-AR')}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          linkedNoteIds.has(note.id)
                            ? 'bg-green-500/10 text-green-500'
                            : 'bg-yellow-500/10 text-yellow-500'
                        }`}
                      >
                        {linkedNoteIds.has(note.id) ? 'Facturado' : 'Pendiente'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setPreviewNote(note)}
                        className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Ver remito
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
