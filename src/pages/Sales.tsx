import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import type { Client, DeliveryNote, Sale } from '../types';

const paymentLabels: Record<Sale['payment_method'], string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

function NewSaleForm({
  clients,
  deliveryNotes,
  onSaved,
  onCancel,
}: {
  clients: Client[];
  deliveryNotes: DeliveryNote[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [deliveryNoteId, setDeliveryNoteId] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<Sale['payment_method']>('cash');
  const [isFormal, setIsFormal] = useState(false);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { error } = await supabase.from('sales').insert({
      client_id: clientId,
      delivery_note_id: deliveryNoteId || null,
      total_amount: Number(totalAmount),
      payment_method: paymentMethod,
      is_formal: isFormal,
    });

    if (error) {
      setStatus('error');
      setErrorMessage('No se pudo registrar la venta. Verificá tu conexión.');
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
          <label className="block text-sm font-medium text-gray-300 mb-1">Remito asociado (opcional)</label>
          <select
            value={deliveryNoteId}
            onChange={(e) => setDeliveryNoteId(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          >
            <option value="">Sin remito</option>
            {deliveryNotes.map((note) => (
              <option key={note.id} value={note.id}>
                Remito N.º {String(note.number).padStart(6, '0')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Monto total</label>
          <input
            required
            type="number"
            step="any"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Medio de pago</label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as Sale['payment_method'])}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          >
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
          </select>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={isFormal} onChange={(e) => setIsFormal(e.target.checked)} />
        Comprobante formal (factura)
      </label>

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
            disabled={status === 'saving' || !clientId}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [salesResult, clientsResult, notesResult] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('delivery_notes').select('*').order('created_at', { ascending: false }),
    ]);
    setSales((salesResult.data ?? []) as Sale[]);
    setClients((clientsResult.data ?? []) as Client[]);
    setDeliveryNotes((notesResult.data ?? []) as DeliveryNote[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    loadData();
  }

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Ventas</h1>
        <button
          onClick={() => setShowForm(true)}
          disabled={clients.length === 0}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
        >
          <Plus size={16} />
          Nueva venta
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Nueva venta</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <NewSaleForm clients={clients} deliveryNotes={deliveryNotes} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-400">Cargando ventas...</p>
        ) : sales.length === 0 ? (
          <p className="p-5 text-gray-400">No hay ventas registradas todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Monto</th>
                <th className="px-5 py-3">Medio de pago</th>
                <th className="px-5 py-3">Comprobante</th>
                <th className="px-5 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3 text-white font-medium">{clientsById[sale.client_id]?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-300">${sale.total_amount.toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-300">{paymentLabels[sale.payment_method]}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        sale.is_formal ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-400'
                      }`}
                    >
                      {sale.is_formal ? 'Formal' : 'Informal'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{new Date(sale.created_at).toLocaleDateString('es-AR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
