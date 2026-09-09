import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { PrintButton } from '../components/PrintButton';
import { SalePreview } from '../components/SalePreview';
import { ShareButton } from '../components/ShareButton';
import { WhatsAppWebButton } from '../components/WhatsAppWebButton';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { paymentLabels } from '../lib/payments';
import type { Client, DeliveryNote, PaymentMethod, Product, Profile, Sale, SaleDeliveryNote, SalePayment } from '../types';

// El remito no guarda precio: se factura al precio ACTUAL del producto, no al que tenía al entregarse.
function deliveryNoteTotal(note: DeliveryNote, productsById: Record<string, Product>): number {
  return note.items.reduce((sum, item) => sum + item.quantity * (productsById[item.product_id]?.price ?? 0), 0);
}

interface PaymentLineState {
  method: PaymentMethod;
  amount: string;
  discountPercent: string;
  checkBank: string;
  checkNumber: string;
  checkDueDate: string;
  checkIsDeferred: boolean;
}

function emptyPaymentLine(): PaymentLineState {
  return {
    method: 'cash',
    amount: '',
    discountPercent: '0',
    checkBank: '',
    checkNumber: '',
    checkDueDate: '',
    checkIsDeferred: false,
  };
}

function paymentLineFinalAmount(line: PaymentLineState): number {
  const raw = Number(line.amount) || 0;
  const discount = line.method === 'cash' ? Number(line.discountPercent) || 0 : 0;
  return raw * (1 - discount / 100);
}

function NewSaleForm({
  clients,
  deliveryNotes,
  linkedNoteIds,
  productsById,
  onSaved,
  onCancel,
}: {
  clients: Client[];
  deliveryNotes: DeliveryNote[];
  linkedNoteIds: Set<string>;
  productsById: Record<string, Product>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [paymentLines, setPaymentLines] = useState<PaymentLineState[]>([emptyPaymentLine()]);
  const [isFormal, setIsFormal] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  const availableNotes = deliveryNotes.filter((note) => note.client_id === clientId && !linkedNoteIds.has(note.id));
  const selectedNotesTotal = selectedNoteIds.reduce((sum, id) => {
    const note = availableNotes.find((n) => n.id === id);
    return sum + (note ? deliveryNoteTotal(note, productsById) : 0);
  }, 0);
  const totalFinal = paymentLines.reduce((sum, line) => sum + paymentLineFinalAmount(line), 0);

  function toggleNote(id: string) {
    setSelectedNoteIds((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));
  }

  function updateLine(index: number, patch: Partial<PaymentLineState>) {
    setPaymentLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setPaymentLines((prev) => [...prev, emptyPaymentLine()]);
  }

  function removeLine(index: number) {
    setPaymentLines((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const payments = paymentLines.map((line) => ({
      method: line.method,
      amount: paymentLineFinalAmount(line),
      discount_percent: line.method === 'cash' ? Number(line.discountPercent) || 0 : 0,
      check:
        line.method === 'checks'
          ? {
              bank: line.checkBank,
              check_number: line.checkNumber,
              due_date: line.checkDueDate,
              is_deferred: line.checkIsDeferred,
            }
          : null,
    }));

    const { data, error } = await supabase.functions.invoke('register-sale', {
      body: {
        client_id: clientId,
        delivery_note_ids: selectedNoteIds,
        payments,
        is_formal: isFormal,
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
      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Cliente</label>
        <select
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setSelectedNoteIds([]);
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
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
          Remitos a facturar (opcional, uno o varios)
        </label>
        {availableNotes.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Este cliente no tiene remitos pendientes de facturar.</p>
        ) : (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-800">
            {availableNotes.map((note) => (
              <label
                key={note.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-100/60 dark:hover:bg-gray-800/60"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedNoteIds.includes(note.id)}
                    onChange={() => toggleNote(note.id)}
                  />
                  Remito N.º {String(note.number).padStart(6, '0')} —{' '}
                  {new Date(note.created_at).toLocaleDateString('es-AR')}
                </span>
                <span className="text-gray-900 dark:text-white font-medium">${deliveryNoteTotal(note, productsById).toFixed(2)}</span>
              </label>
            ))}
          </div>
        )}
        {selectedNoteIds.length > 0 && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Total de remitos seleccionados (a precio actual): <span className="text-gray-900 dark:text-white font-medium">${selectedNotesTotal.toFixed(2)}</span> — repartilo entre las formas de pago de abajo.
          </p>
        )}
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300">Formas de pago</label>
        {paymentLines.map((line, index) => (
          <div key={index} className="space-y-3 rounded-lg border border-gray-300 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <select
                value={line.method}
                onChange={(e) => updateLine(index, { method: e.target.value as PaymentMethod })}
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="checks">Valores</option>
              </select>
              <button
                type="button"
                onClick={() => removeLine(index)}
                disabled={paymentLines.length === 1}
                className="text-gray-500 dark:text-gray-400 hover:text-red-500 disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Monto</label>
                <input
                  required
                  type="number"
                  step="any"
                  value={line.amount}
                  onChange={(e) => updateLine(index, { amount: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                />
              </div>
              {line.method === 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Descuento efectivo (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={line.discountPercent}
                    onChange={(e) => updateLine(index, { discountPercent: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                  />
                </div>
              )}
            </div>

            {line.method === 'cash' && (Number(line.discountPercent) || 0) > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Monto final de esta línea: <span className="text-gray-900 dark:text-white font-medium">${paymentLineFinalAmount(line).toFixed(2)}</span>
              </p>
            )}

            {line.method === 'checks' && (
              <div className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Datos del cheque</p>
                <div className="grid grid-cols-2 gap-4">
                  <input
                    required
                    value={line.checkBank}
                    onChange={(e) => updateLine(index, { checkBank: e.target.value })}
                    placeholder="Banco"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                  />
                  <input
                    required
                    value={line.checkNumber}
                    onChange={(e) => updateLine(index, { checkNumber: e.target.value })}
                    placeholder="N.º de cheque"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Fecha de cobro</label>
                    <input
                      required
                      type="date"
                      value={line.checkDueDate}
                      onChange={(e) => updateLine(index, { checkDueDate: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 pb-2">
                    <input
                      type="checkbox"
                      checked={line.checkIsDeferred}
                      onChange={(e) => updateLine(index, { checkIsDeferred: e.target.checked })}
                    />
                    Cheque de pago diferido
                  </label>
                </div>
              </div>
            )}
          </div>
        ))}
        <button type="button" onClick={addLine} className="text-sm text-orange-500 hover:text-orange-400">
          + Agregar forma de pago
        </button>
      </div>

      <p className="text-right text-gray-900 dark:text-white font-medium">Total: ${totalFinal.toFixed(2)}</p>

      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input type="checkbox" checked={isFormal} onChange={(e) => setIsFormal(e.target.checked)} />
        Comprobante formal (factura)
      </label>

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
            disabled={status === 'saving' || !clientId || totalFinal <= 0}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Registrar venta
          </button>
        </div>
      </div>
    </form>
  );
}

export function Sales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saleDeliveryNotes, setSaleDeliveryNotes] = useState<SaleDeliveryNote[]>([]);
  const [salePayments, setSalePayments] = useState<SalePayment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [previewSale, setPreviewSale] = useState<Sale | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [salesResult, clientsResult, notesResult, productsResult, linksResult, paymentsResult, profilesResult] =
      await Promise.all([
        supabase.from('sales').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('name'),
        supabase.from('delivery_notes').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('sale_delivery_notes').select('*'),
        supabase.from('sale_payments').select('*'),
        supabase.from('profiles').select('*'),
      ]);
    setSales((salesResult.data ?? []) as Sale[]);
    setClients((clientsResult.data ?? []) as Client[]);
    setDeliveryNotes((notesResult.data ?? []) as DeliveryNote[]);
    setProducts((productsResult.data ?? []) as Product[]);
    setSaleDeliveryNotes((linksResult.data ?? []) as SaleDeliveryNote[]);
    setSalePayments((paymentsResult.data ?? []) as SalePayment[]);
    setProfiles((profilesResult.data ?? []) as Profile[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    loadData();
  }

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const notesById = Object.fromEntries(deliveryNotes.map((n) => [n.id, n]));
  const linkedNoteIds = new Set(saleDeliveryNotes.map((link) => link.delivery_note_id));
  const notesBySaleId = saleDeliveryNotes.reduce<Record<string, DeliveryNote[]>>((acc, link) => {
    const note = notesById[link.delivery_note_id];
    if (!note) return acc;
    (acc[link.sale_id] ??= []).push(note);
    return acc;
  }, {});
  const paymentsBySaleId = salePayments.reduce<Record<string, SalePayment[]>>((acc, payment) => {
    (acc[payment.sale_id] ??= []).push(payment);
    return acc;
  }, {});

  const filteredSales = sales.filter((sale) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const clientName = clientsById[sale.client_id]?.name ?? '';
    const noteNumbers = (notesBySaleId[sale.id] ?? []).map((note) => String(note.number).padStart(6, '0'));
    return clientName.toLowerCase().includes(term) || noteNumbers.some((n) => n.includes(term));
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Ventas</h1>
        <button
          onClick={() => setShowForm(true)}
          disabled={clients.length === 0}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
        >
          <Plus size={16} />
          Nueva venta
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

      {previewSale && (
        <div className="space-y-3">
          <div className="print:hidden flex items-center justify-between">
            <button onClick={() => setPreviewSale(null)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              ← Volver al listado
            </button>
            <div className="flex gap-3">
              <PrintButton />
              <ShareButton
                targetRef={previewRef}
                fileName={`venta-${previewSale.id.slice(0, 8)}.pdf`}
                shareTitle="Comprobante de venta"
              />
              <WhatsAppWebButton
                targetRef={previewRef}
                fileName={`venta-${previewSale.id.slice(0, 8)}.pdf`}
                phone={clientsById[previewSale.client_id]?.phone ?? null}
                message="Hola! Te paso el comprobante de tu compra."
              />
            </div>
          </div>
          <div ref={previewRef}>
            <SalePreview
              sale={previewSale}
              client={clientsById[previewSale.client_id]}
              deliveryNotes={notesBySaleId[previewSale.id] ?? []}
              payments={paymentsBySaleId[previewSale.id] ?? []}
            />
          </div>
        </div>
      )}

      {!previewSale && showForm && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Nueva venta</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          <NewSaleForm
            clients={clients}
            deliveryNotes={deliveryNotes}
            linkedNoteIds={linkedNoteIds}
            productsById={productsById}
            onSaved={handleSaved}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {!previewSale && (
      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Cargando ventas...</p>
        ) : sales.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">No hay ventas registradas todavía.</p>
        ) : filteredSales.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Ninguna venta coincide con la búsqueda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Monto</th>
                <th className="px-5 py-3">Formas de pago</th>
                <th className="px-5 py-3">Comprobante</th>
                <th className="px-5 py-3">Remitos</th>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Cargado por</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.map((sale) => {
                const payments = paymentsBySaleId[sale.id] ?? [];
                return (
                  <tr key={sale.id} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                    <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{clientsById[sale.client_id]?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">${sale.total_amount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {payments.length === 0 ? (
                        paymentLabels[sale.payment_method]
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {payments.map((payment) => (
                            <span key={payment.id}>
                              {paymentLabels[payment.method]}: ${payment.amount.toFixed(2)}
                              {payment.discount_percent > 0 && (
                                <span className="ml-1 text-xs text-orange-500">-{payment.discount_percent}%</span>
                              )}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          sale.is_formal ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        {sale.is_formal ? 'Formal' : 'Informal'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {notesBySaleId[sale.id]?.length
                        ? notesBySaleId[sale.id]
                            .map((note) => String(note.number).padStart(6, '0'))
                            .join(', ')
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{new Date(sale.created_at).toLocaleDateString('es-AR')}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {sale.created_by ? profilesById[sale.created_by]?.name ?? '—' : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setPreviewSale(sale)}
                        className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Ver
                      </button>
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
