import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DeliveryNotePreview } from '../components/DeliveryNotePreview';
import { PrintButton } from '../components/PrintButton';
import { ShareButton } from '../components/ShareButton';
import { WhatsAppWebButton } from '../components/WhatsAppWebButton';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { paymentLabels } from '../lib/payments';
import { formatCurrency } from '../lib/format';
import type { Client, ClientWorkAddress, DeliveryNote, Product, Sale, SaleDeliveryNote, SalePayment } from '../types';

function EditAddressForm({
  client,
  onSaved,
  onCancel,
}: {
  client: Client;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [address, setAddress] = useState(client.address ?? '');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { error } = await supabase.from('clients').update({ address: address || null }).eq('id', client.id);

    if (error) {
      setStatus('error');
      setErrorMessage('No se pudo guardar el domicilio. Verificá tu conexión.');
      return;
    }

    setStatus('saved');
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Calle, número, localidad"
        className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-white"
      />
      <SaveStatusIndicator status={status} errorMessage={errorMessage} />
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={status === 'saving'}
        className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
      >
        Guardar
      </button>
    </form>
  );
}

function NewWorkAddressForm({
  clientId,
  onSaved,
  onCancel,
}: {
  clientId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { error } = await supabase.from('client_work_addresses').insert({ client_id: clientId, label, address });

    if (error) {
      setStatus('error');
      setErrorMessage('No se pudo guardar la dirección. Verificá tu conexión.');
      return;
    }

    setStatus('saved');
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ej: Obra Ruta 9 km 45"
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
        />
        <input
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Dirección"
          className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
        />
      </div>
      <div className="flex items-center justify-between">
        <SaveStatusIndicator status={status} errorMessage={errorMessage} />
        <div className="flex gap-3 ml-auto">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={status === 'saving'}
            className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </div>
    </form>
  );
}

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [saleDeliveryNotes, setSaleDeliveryNotes] = useState<SaleDeliveryNote[]>([]);
  const [salePayments, setSalePayments] = useState<SalePayment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workAddresses, setWorkAddresses] = useState<ClientWorkAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewNote, setPreviewNote] = useState<DeliveryNote | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [showAddWorkAddress, setShowAddWorkAddress] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  async function loadData(clientId: string) {
    setLoading(true);
    const [clientResult, salesResult, notesResult, productsResult, linksResult, paymentsResult, workAddressesResult] =
      await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('sales').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('delivery_notes').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('products').select('*'),
        supabase.from('sale_delivery_notes').select('*'),
        supabase.from('sale_payments').select('*'),
        supabase.from('client_work_addresses').select('*').eq('client_id', clientId).order('created_at'),
      ]);
    setClient((clientResult.data ?? null) as Client | null);
    setSales((salesResult.data ?? []) as Sale[]);
    setDeliveryNotes((notesResult.data ?? []) as DeliveryNote[]);
    setProducts((productsResult.data ?? []) as Product[]);
    setSaleDeliveryNotes((linksResult.data ?? []) as SaleDeliveryNote[]);
    setSalePayments((paymentsResult.data ?? []) as SalePayment[]);
    setWorkAddresses((workAddressesResult.data ?? []) as ClientWorkAddress[]);
    setLoading(false);
  }

  function handleAddressSaved() {
    setEditingAddress(false);
    if (id) loadData(id);
  }

  function handleWorkAddressSaved() {
    setShowAddWorkAddress(false);
    if (id) loadData(id);
  }

  async function deleteWorkAddress(addressId: string) {
    await supabase.from('client_work_addresses').delete().eq('id', addressId);
    if (id) loadData(id);
  }

  const productsById = Object.fromEntries(products.map((p) => [p.id, p]));
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

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Cargando cliente...</p>;
  }

  if (!client) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500 dark:text-gray-400">Cliente no encontrado.</p>
        <Link to="/clientes" className="text-sm text-orange-500 hover:text-orange-400">
          ← Volver a clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link to="/clientes" className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white w-fit">
        <ArrowLeft size={16} />
        Volver a clientes
      </Link>

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{client.name}</h1>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
          <span>CUIT/DNI: {client.tax_id ?? '—'}</span>
          <span>Teléfono: {client.phone ?? '—'}</span>
          <span className={client.account_balance > 0 ? 'text-red-500' : 'text-green-500'}>
            Cuenta corriente: {formatCurrency(client.account_balance)}
          </span>
        </div>

        <div className="mt-3">
          {editingAddress ? (
            <EditAddressForm client={client} onSaved={handleAddressSaved} onCancel={() => setEditingAddress(false)} />
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Domicilio: {client.address ?? '—'}</span>
              <button
                onClick={() => setEditingAddress(true)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white"
                title="Editar domicilio"
              >
                <Pencil size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {!previewNote && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Direcciones de obra</h2>
            <button
              onClick={() => setShowAddWorkAddress(true)}
              className="flex items-center gap-2 rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              <Plus size={14} />
              Agregar dirección
            </button>
          </div>

          {showAddWorkAddress && (
            <div className="mb-4 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white">Nueva dirección de obra</p>
                <button onClick={() => setShowAddWorkAddress(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <NewWorkAddressForm clientId={client.id} onSaved={handleWorkAddressSaved} onCancel={() => setShowAddWorkAddress(false)} />
            </div>
          )}

          {workAddresses.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Sin direcciones de obra registradas.</p>
          ) : (
            <ul className="space-y-2">
              {workAddresses.map((workAddress) => (
                <li
                  key={workAddress.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2 text-sm"
                >
                  <span className="text-gray-600 dark:text-gray-300">
                    <span className="text-gray-900 dark:text-white font-medium">{workAddress.label}</span> — {workAddress.address}
                  </span>
                  <button
                    onClick={() => deleteWorkAddress(workAddress.id)}
                    className="text-gray-400 dark:text-gray-500 hover:text-red-500"
                    title="Eliminar dirección"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {previewNote ? (
        <div className="space-y-3">
          <div className="print:hidden flex items-center justify-between">
            <button onClick={() => setPreviewNote(null)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              ← Volver al historial
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
                phone={client.phone}
                message={`Hola! Te paso el remito N.º ${String(previewNote.number).padStart(6, '0')}.`}
              />
            </div>
          </div>
          <div ref={previewRef} className="print-area">
            <DeliveryNotePreview deliveryNote={previewNote} client={client} productsById={productsById} />
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
            <h2 className="px-5 py-4 text-lg font-medium text-gray-900 dark:text-white border-b border-gray-300 dark:border-gray-700">Remitos</h2>
            {deliveryNotes.length === 0 ? (
              <p className="p-5 text-gray-500 dark:text-gray-400">Sin remitos registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                    <th className="px-5 py-3">N.º</th>
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Ítems</th>
                    <th className="px-5 py-3">Facturación</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryNotes.map((note) => {
                    return (
                      <tr key={note.id} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                        <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">
                          {String(note.number).padStart(6, '0')}
                        </td>
                        <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                          {new Date(note.created_at).toLocaleDateString('es-AR')}
                        </td>
                        <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{note.items.length}</td>
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
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
            <h2 className="px-5 py-4 text-lg font-medium text-gray-900 dark:text-white border-b border-gray-300 dark:border-gray-700">Ventas</h2>
            {sales.length === 0 ? (
              <p className="p-5 text-gray-500 dark:text-gray-400">Sin ventas registradas.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                    <th className="px-5 py-3">Fecha</th>
                    <th className="px-5 py-3">Monto</th>
                    <th className="px-5 py-3">Formas de pago</th>
                    <th className="px-5 py-3">Comprobante</th>
                    <th className="px-5 py-3">Remitos</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => {
                    const payments = paymentsBySaleId[sale.id] ?? [];
                    return (
                    <tr key={sale.id} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                        {new Date(sale.created_at).toLocaleDateString('es-AR')}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{formatCurrency(sale.total_amount)}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {payments.length === 0 ? (
                          paymentLabels[sale.payment_method]
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {payments.map((payment) => (
                              <span key={payment.id}>
                                {paymentLabels[payment.method]}: {formatCurrency(payment.amount)}
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
                          ? notesBySaleId[sale.id].map((note) => String(note.number).padStart(6, '0')).join(', ')
                          : '—'}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
