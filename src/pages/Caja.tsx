import { useEffect, useState } from 'react';
import { Calendar, CalendarClock, CalendarDays, CalendarRange } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { StatCard } from '../components/StatCard';
import { formatCurrency } from '../lib/format';
import { paymentLabels } from '../lib/payments';
import type { Client, PaymentMethod } from '../types';

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

export function Caja() {
  const [payments, setPayments] = useState<SalePaymentRow[]>([]);
  const [salesById, setSalesById] = useState<Record<string, { client_id: string }>>({});
  const [clientsById, setClientsById] = useState<Record<string, Client>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('day');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCaja();
  }, []);

  async function loadCaja() {
    setLoading(true);

    const yearStart = startOfYear(new Date());

    const [paymentsResult, salesResult, clientsResult] = await Promise.all([
      supabase
        .from('sale_payments')
        .select('id, sale_id, method, amount, created_at')
        .gte('created_at', yearStart.toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('sales').select('id, client_id').gte('created_at', yearStart.toISOString()),
      supabase.from('clients').select('*'),
    ]);

    setPayments((paymentsResult.data ?? []) as SalePaymentRow[]);
    setSalesById(
      Object.fromEntries(((salesResult.data ?? []) as { id: string; client_id: string }[]).map((sale) => [sale.id, sale])),
    );
    setClientsById(Object.fromEntries(((clientsResult.data ?? []) as Client[]).map((client) => [client.id, client])));
    setLoading(false);
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
