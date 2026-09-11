import { useEffect, useState, type FormEvent } from 'react';
import { Calendar, CalendarClock, CalendarDays, CalendarRange, Lock, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StatCard } from '../components/StatCard';
import { formatCurrency } from '../lib/format';
import { paymentLabels } from '../lib/payments';
import { useAuth } from '../context/AuthContext';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import type { CashClosing, Client, PaymentMethod, Profile } from '../types';

interface SalePaymentRow {
  id: string;
  sale_id: string;
  method: PaymentMethod;
  amount: number;
  created_at: string;
}

type PeriodKey = 'day' | 'week' | 'month' | 'year';

const periodLabels: Record<PeriodKey, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
  year: 'Año',
};

const paymentMethods: PaymentMethod[] = ['cash', 'transfer', 'checks'];

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const day = result.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diffToMonday);
  return result;
}

function startOfMonth(date: Date) {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}

function startOfYear(date: Date) {
  const result = startOfDay(date);
  result.setMonth(0, 1);
  return result;
}

function sumSince(payments: SalePaymentRow[], since: Date) {
  return payments
    .filter((payment) => new Date(payment.created_at) >= since)
    .reduce((sum, payment) => sum + payment.amount, 0);
}

function NewClosingForm({
  periodStart,
  onSaved,
  onCancel,
}: {
  periodStart: string | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [loadingTotals, setLoadingTotals] = useState(true);
  const [expectedCash, setExpectedCash] = useState(0);
  const [transferTotal, setTransferTotal] = useState(0);
  const [checksTotal, setChecksTotal] = useState(0);
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    loadTotals();
  }, []);

  async function loadTotals() {
    setLoadingTotals(true);
    let query = supabase.from('sale_payments').select('method, amount');
    if (periodStart) query = query.gte('created_at', periodStart);
    const { data } = await query;
    const rows = (data ?? []) as { method: PaymentMethod; amount: number }[];
    setExpectedCash(rows.filter((r) => r.method === 'cash').reduce((sum, r) => sum + r.amount, 0));
    setTransferTotal(rows.filter((r) => r.method === 'transfer').reduce((sum, r) => sum + r.amount, 0));
    setChecksTotal(rows.filter((r) => r.method === 'checks').reduce((sum, r) => sum + r.amount, 0));
    setLoadingTotals(false);
  }

  const counted = Number(countedCash) || 0;
  const difference = counted - expectedCash;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { error } = await supabase.from('cash_closings').insert({
      period_start: periodStart,
      expected_cash: expectedCash,
      counted_cash: counted,
      transfer_total: transferTotal,
      checks_total: checksTotal,
      notes: notes || null,
      created_by: user?.id ?? null,
    });

    if (error) {
      setStatus('error');
      setErrorMessage('No se pudo guardar el cierre. Verificá tu conexión.');
      return;
    }

    setStatus('saved');
    onSaved();
  }

  if (loadingTotals) {
    return <p className="text-gray-500 dark:text-gray-400">Calculando totales del período...</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Período a cerrar: {periodStart ? `desde ${new Date(periodStart).toLocaleString('es-AR')}` : 'desde el inicio de los registros'} hasta ahora.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Efectivo esperado</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(expectedCash)}</p>
        </div>
        <div className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Transferencias del período</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(transferTotal)}</p>
        </div>
        <div className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Cheques del período</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(checksTotal)}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Efectivo contado</label>
        <input
          required
          type="number"
          step="any"
          value={countedCash}
          onChange={(e) => setCountedCash(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          placeholder="0.00"
        />
      </div>

      {countedCash !== '' && (
        <p
          className={`text-sm font-medium ${
            difference === 0 ? 'text-gray-600 dark:text-gray-300' : difference > 0 ? 'text-green-500' : 'text-red-500'
          }`}
        >
          {difference === 0
            ? 'Cuadra exacto.'
            : difference > 0
              ? `Sobran ${formatCurrency(difference)}`
              : `Faltan ${formatCurrency(Math.abs(difference))}`}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Notas (opcional)</label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          placeholder="Ej: faltante por vuelto mal dado"
        />
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
            disabled={status === 'saving'}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Cerrar caja
          </button>
        </div>
      </div>
    </form>
  );
}

export function Caja() {
  const [payments, setPayments] = useState<SalePaymentRow[]>([]);
  const [salesById, setSalesById] = useState<Record<string, { client_id: string }>>({});
  const [clientsById, setClientsById] = useState<Record<string, Client>>({});
  const [closings, setClosings] = useState<CashClosing[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('day');
  const [showClosingForm, setShowClosingForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCaja();
  }, []);

  async function loadCaja() {
    setLoading(true);

    const yearStart = startOfYear(new Date());

    const [paymentsResult, salesResult, clientsResult, closingsResult, profilesResult] = await Promise.all([
      supabase
        .from('sale_payments')
        .select('id, sale_id, method, amount, created_at')
        .gte('created_at', yearStart.toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('sales').select('id, client_id').gte('created_at', yearStart.toISOString()),
      supabase.from('clients').select('*'),
      supabase.from('cash_closings').select('*').order('period_end', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]);

    setPayments((paymentsResult.data ?? []) as SalePaymentRow[]);
    setSalesById(
      Object.fromEntries(((salesResult.data ?? []) as { id: string; client_id: string }[]).map((sale) => [sale.id, sale])),
    );
    setClientsById(Object.fromEntries(((clientsResult.data ?? []) as Client[]).map((client) => [client.id, client])));
    setClosings((closingsResult.data ?? []) as CashClosing[]);
    setProfiles((profilesResult.data ?? []) as Profile[]);
    setLoading(false);
  }

  function handleClosingSaved() {
    setShowClosingForm(false);
    loadCaja();
  }

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Cargando caja...</p>;
  }

  const now = new Date();
  const periodStarts: Record<PeriodKey, Date> = {
    day: startOfDay(now),
    week: startOfWeek(now),
    month: startOfMonth(now),
    year: startOfYear(now),
  };

  const totals: Record<PeriodKey, number> = {
    day: sumSince(payments, periodStarts.day),
    week: sumSince(payments, periodStarts.week),
    month: sumSince(payments, periodStarts.month),
    year: sumSince(payments, periodStarts.year),
  };

  const selectedPayments = payments.filter((payment) => new Date(payment.created_at) >= periodStarts[selectedPeriod]);

  const breakdown = paymentMethods.reduce(
    (acc, method) => {
      acc[method] = selectedPayments.filter((payment) => payment.method === method).reduce((sum, p) => sum + p.amount, 0);
      return acc;
    },
    {} as Record<PaymentMethod, number>,
  );

  const lastClosing = closings[0] ?? null;
  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Caja</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Ingresos de hoy" value={formatCurrency(totals.day)} icon={CalendarDays} />
        <StatCard label="Ingresos de la semana" value={formatCurrency(totals.week)} icon={CalendarRange} />
        <StatCard label="Ingresos del mes" value={formatCurrency(totals.month)} icon={Calendar} />
        <StatCard label="Ingresos del año" value={formatCurrency(totals.year)} icon={CalendarClock} />
      </div>

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Cierres de caja</h2>
          <button
            onClick={() => setShowClosingForm(true)}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500"
          >
            <Lock size={16} />
            Nuevo cierre
          </button>
        </div>

        {showClosingForm && (
          <div className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-5 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-gray-900 dark:text-white">Nuevo cierre</h3>
              <button onClick={() => setShowClosingForm(false)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                <X size={18} />
              </button>
            </div>
            <NewClosingForm
              periodStart={lastClosing?.period_end ?? null}
              onSaved={handleClosingSaved}
              onCancel={() => setShowClosingForm(false)}
            />
          </div>
        )}

        {closings.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No hay cierres registrados todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                  <th className="py-2 pr-4">Período</th>
                  <th className="py-2 pr-4">Esperado</th>
                  <th className="py-2 pr-4">Contado</th>
                  <th className="py-2 pr-4">Diferencia</th>
                  <th className="py-2 pr-4">Transferencias</th>
                  <th className="py-2 pr-4">Cheques</th>
                  <th className="py-2">Cerrado por</th>
                </tr>
              </thead>
              <tbody>
                {closings.map((closing) => (
                  <tr key={closing.id} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">
                      {closing.period_start ? new Date(closing.period_start).toLocaleString('es-AR') : 'Desde el inicio'}
                      {' → '}
                      {new Date(closing.period_end).toLocaleString('es-AR')}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{formatCurrency(closing.expected_cash)}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white font-medium">{formatCurrency(closing.counted_cash)}</td>
                    <td
                      className={`py-2 pr-4 font-medium ${
                        closing.difference === 0 ? 'text-gray-600 dark:text-gray-300' : closing.difference > 0 ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {closing.difference === 0
                        ? '—'
                        : closing.difference > 0
                          ? `+${formatCurrency(closing.difference)}`
                          : `-${formatCurrency(Math.abs(closing.difference))}`}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{formatCurrency(closing.transfer_total)}</td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{formatCurrency(closing.checks_total)}</td>
                    <td className="py-2 text-gray-600 dark:text-gray-300">
                      {closing.created_by ? profilesById[closing.created_by]?.name ?? '—' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white">Detalle por período</h2>
          <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-1 gap-1">
            {(Object.keys(periodLabels) as PeriodKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPeriod(key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  selectedPeriod === key ? 'bg-orange-600 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {periodLabels[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {paymentMethods.map((method) => (
            <div key={method} className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-4">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{paymentLabels[method]}</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatCurrency(breakdown[method])}</p>
            </div>
          ))}
        </div>

        {selectedPayments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Sin ingresos registrados en este período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                  <th className="py-2 pr-4">Cliente</th>
                  <th className="py-2 pr-4">Método</th>
                  <th className="py-2 pr-4">Monto</th>
                  <th className="py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {selectedPayments.map((payment) => {
                  const sale = salesById[payment.sale_id];
                  const client = sale ? clientsById[sale.client_id] : undefined;
                  return (
                    <tr key={payment.id} className="border-b border-gray-200 dark:border-gray-800 last:border-0">
                      <td className="py-2 pr-4 text-gray-900 dark:text-white font-medium">{client?.name ?? 'Cliente eliminado'}</td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{paymentLabels[payment.method]}</td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{formatCurrency(payment.amount)}</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">{new Date(payment.created_at).toLocaleString('es-AR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
