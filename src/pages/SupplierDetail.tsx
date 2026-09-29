import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { paymentLabels } from '../lib/payments';
import { formatCurrency, formatDateOnly, supplierBalanceLabel } from '../lib/format';
import type { PaymentMethod, Purchase, Supplier, SupplierPayment } from '../types';

function todayLocal(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function NewPaymentForm({ supplier, onSaved, onCancel }: { supplier: Supplier; onSaved: () => void; onCancel: () => void }) {
  const currentBalance = Number(supplier.account_balance);
  const [paymentDate, setPaymentDate] = useState(todayLocal);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amount, setAmount] = useState(currentBalance > 0 ? String(currentBalance) : '');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  const balanceAfter = Math.round((currentBalance - (Number(amount) || 0)) * 100) / 100;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    // El saldo del proveedor lo descuenta un trigger en la base al insertar el pago.
    const { error } = await supabase.from('supplier_payments').insert({
      supplier_id: supplier.id,
      payment_date: paymentDate,
      method,
      amount: Number(amount),
      notes: notes || null,
    });

    if (error) {
      setStatus('error');
      setErrorMessage('No se pudo guardar el pago. Verificá tu conexión.');
      return;
    }

    setStatus('saved');
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Fecha de pago</label>
          <input
            required
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Forma de pago</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          >
            <option value="cash">Efectivo</option>
            <option value="transfer">Transferencia</option>
            <option value="checks">Valores</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Monto</label>
          <input
            required
            type="number"
            step="any"
            min={0.01}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Notas (opcional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          placeholder="Ej: N.º de transferencia"
        />
      </div>

      {(Number(amount) || 0) > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Cuenta corriente después del pago:{' '}
          <span className={`font-medium ${balanceAfter > 0 ? 'text-red-500' : 'text-green-500'}`}>{supplierBalanceLabel(balanceAfter)}</span>
        </p>
      )}

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
            disabled={status === 'saving' || (Number(amount) || 0) <= 0}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Registrar pago
          </button>
        </div>
      </div>
    </form>
  );
}

// Un movimiento de la cuenta corriente: + suma a la deuda, - la descuenta.
interface AccountMovement {
  key: string;
  date: string; // 'YYYY-MM-DD'
  created_at: string;
  concept: string;
  detail: string;
  change: number;
}

export function SupplierDetail() {
  const { id } = useParams();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    const [supplierResult, purchasesResult, paymentsResult] = await Promise.all([
      supabase.from('suppliers').select('*').eq('id', id).single(),
      supabase.from('purchases').select('*').eq('supplier_id', id),
      supabase.from('supplier_payments').select('*').eq('supplier_id', id),
    ]);
    setSupplier((supplierResult.data ?? null) as Supplier | null);
    setPurchases((purchasesResult.data ?? []) as Purchase[]);
    setPayments((paymentsResult.data ?? []) as SupplierPayment[]);
    setLoading(false);
  }

  function handlePaymentSaved() {
    setShowPaymentForm(false);
    loadData();
  }

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Cargando proveedor...</p>;
  }

  if (!supplier) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500 dark:text-gray-400">Proveedor no encontrado.</p>
        <Link to="/proveedores" className="text-sm text-orange-500 hover:text-orange-400">
          ← Volver a proveedores
        </Link>
      </div>
    );
  }

  const balance = Number(supplier.account_balance ?? 0);

  // Movimientos: compras (lo que quedó a cuenta) y pagos, del más reciente al más viejo.
  const movements: AccountMovement[] = [
    ...purchases.map((purchase) => ({
      key: `purchase-${purchase.id}`,
      date: purchase.purchase_date,
      created_at: purchase.created_at,
      concept: Number(purchase.amount_paid ?? purchase.total_amount) === 0 ? 'Compra a cuenta corriente' : 'Compra',
      detail:
        `Total ${formatCurrency(purchase.total_amount)} — pagado ${formatCurrency(purchase.amount_paid ?? purchase.total_amount)}` +
        (purchase.notes ? ` — ${purchase.notes}` : ''),
      change: Number(purchase.account_balance_change ?? 0),
    })),
    ...payments.map((payment) => ({
      key: `payment-${payment.id}`,
      date: payment.payment_date,
      created_at: payment.created_at,
      concept: payment.voided_at ? 'Pago anulado' : 'Pago',
      detail:
        paymentLabels[payment.method] +
        ` ${formatCurrency(payment.amount)}` +
        (payment.notes ? ` — ${payment.notes}` : '') +
        (payment.voided_at ? ` — ${payment.void_reason ?? 'anulado'}` : ''),
      // Un pago anulado (cheque rechazado o devuelto) ya no descuenta la deuda.
      change: payment.voided_at ? 0 : -Number(payment.amount),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));

  // Saldo después de cada movimiento, reconstruido hacia atrás desde el saldo actual.
  let runningBalance = balance;
  const rows = movements.map((movement) => {
    const balanceAfter = runningBalance;
    runningBalance = Math.round((runningBalance - movement.change) * 100) / 100;
    return { ...movement, balanceAfter };
  });

  return (
    <div className="space-y-6">
      <Link to="/proveedores" className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white w-fit">
        <ArrowLeft size={16} />
        Volver a proveedores
      </Link>

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">{supplier.name}</h1>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span>CUIT: {supplier.tax_id ?? '—'}</span>
              <span>Teléfono: {supplier.phone ?? '—'}</span>
            </div>
            <p className={`mt-3 text-lg font-medium ${balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
              Cuenta corriente: {supplierBalanceLabel(balance)}
            </p>
          </div>
          <button
            onClick={() => setShowPaymentForm(true)}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500"
          >
            <Plus size={16} />
            Registrar pago
          </button>
        </div>
      </div>

      {showPaymentForm && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Nuevo pago a {supplier.name}</h2>
            <button onClick={() => setShowPaymentForm(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          <NewPaymentForm supplier={supplier} onSaved={handlePaymentSaved} onCancel={() => setShowPaymentForm(false)} />
        </div>
      )}

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        <h2 className="px-5 pt-5 text-lg font-medium text-gray-900 dark:text-white">Movimientos</h2>
        {rows.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Todavía no hay compras ni pagos con este proveedor.</p>
        ) : (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Concepto</th>
                <th className="px-5 py-3">Detalle</th>
                <th className="px-5 py-3 text-right">Movimiento</th>
                <th className="px-5 py-3 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatDateOnly(row.date)}</td>
                  <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{row.concept}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.detail}</td>
                  <td
                    className={`px-5 py-3 text-right font-medium ${
                      row.change > 0 ? 'text-red-500' : row.change < 0 ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {row.change === 0 ? '—' : `${row.change > 0 ? '+' : '-'}${formatCurrency(Math.abs(row.change))}`}
                  </td>
                  <td className="px-5 py-3 text-right text-gray-900 dark:text-white">{formatCurrency(row.balanceAfter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
