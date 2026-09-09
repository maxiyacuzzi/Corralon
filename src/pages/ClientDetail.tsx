import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DeliveryNotePreview } from '../components/DeliveryNotePreview';
import { PrintButton } from '../components/PrintButton';
import { ShareButton } from '../components/ShareButton';
import { WhatsAppWebButton } from '../components/WhatsAppWebButton';
import { paymentLabels } from '../lib/payments';
import type { Client, DeliveryNote, Product, Sale, SaleDeliveryNote, SalePayment } from '../types';

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [saleDeliveryNotes, setSaleDeliveryNotes] = useState<SaleDeliveryNote[]>([]);
  const [salePayments, setSalePayments] = useState<SalePayment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewNote, setPreviewNote] = useState<DeliveryNote | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadData(id);
  }, [id]);

  async function loadData(clientId: string) {
    setLoading(true);
    const [clientResult, salesResult, notesResult, productsResult, linksResult, paymentsResult] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).single(),
      supabase.from('sales').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('delivery_notes').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('products').select('*'),
      supabase.from('sale_delivery_notes').select('*'),
      supabase.from('sale_payments').select('*'),
    ]);
    setClient((clientResult.data ?? null) as Client | null);
    setSales((salesResult.data ?? []) as Sale[]);
    setDeliveryNotes((notesResult.data ?? []) as DeliveryNote[]);
    setProducts((productsResult.data ?? []) as Product[]);
    setSaleDeliveryNotes((linksResult.data ?? []) as SaleDeliveryNote[]);
    setSalePayments((paymentsResult.data ?? []) as SalePayment[]);
    setLoading(false);
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
            Cuenta corriente: ${client.account_balance.toFixed(2)}
          </span>
        </div>
      </div>

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
          <div ref={previewRef}>
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
