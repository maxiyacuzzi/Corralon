import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import type { Check, CheckStatus, Client } from '../types';

const statusLabels: Record<CheckStatus, string> = {
  in_wallet: 'En cartera',
  deposited: 'Depositado',
  cleared: 'Cobrado',
  rejected: 'Rechazado',
  delivered: 'Entregado a proveedor',
};

const statusStyles: Record<CheckStatus, string> = {
  in_wallet: 'bg-gray-500/10 text-gray-400',
  deposited: 'bg-yellow-500/10 text-yellow-500',
  cleared: 'bg-green-500/10 text-green-500',
  rejected: 'bg-red-500/10 text-red-500',
  delivered: 'bg-orange-500/10 text-orange-500',
};

// Transiciones de estado válidas desde cada estado.
const nextStatuses: Record<CheckStatus, { value: CheckStatus; label: string }[]> = {
  in_wallet: [
    { value: 'deposited', label: 'Depositar' },
    { value: 'delivered', label: 'Entregar a proveedor' },
    { value: 'rejected', label: 'Marcar rechazado' },
  ],
  deposited: [
    { value: 'cleared', label: 'Marcar cobrado' },
    { value: 'rejected', label: 'Marcar rechazado' },
  ],
  cleared: [],
  rejected: [],
  delivered: [],
};

function isOverdue(check: Check): boolean {
  return (check.status === 'in_wallet' || check.status === 'deposited') && check.due_date < new Date().toISOString().slice(0, 10);
}

function NewCheckForm({ clients, onSaved, onCancel }: { clients: Client[]; onSaved: () => void; onCancel: () => void }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? '');
  const [checkNumber, setCheckNumber] = useState('');
  const [bank, setBank] = useState('');
  const [amount, setAmount] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [isDeferred, setIsDeferred] = useState(false);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { error } = await supabase.from('checks').insert({
      client_id: clientId,
      sale_id: null,
      check_number: checkNumber,
      bank,
      amount: Number(amount),
      issue_date: issueDate,
      due_date: dueDate,
      is_deferred: isDeferred,
      notes: notes || null,
      status: 'in_wallet',
    });

    if (error) {
      setStatus('error');
      setErrorMessage('No se pudo guardar el cheque. Verificá tu conexión.');
      return;
    }

    setStatus('saved');
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Cliente (quién lo dio)</label>
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
          <label className="block text-sm font-medium text-gray-300 mb-1">Banco</label>
          <input
            required
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
            placeholder="Banco Galicia"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">N.º de cheque</label>
          <input
            required
            value={checkNumber}
            onChange={(e) => setCheckNumber(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Monto</label>
          <input
            required
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Fecha recibido</label>
          <input
            required
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Fecha de cobro</label>
          <input
            required
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" checked={isDeferred} onChange={(e) => setIsDeferred(e.target.checked)} />
        Cheque de pago diferido
      </label>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
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
            disabled={status === 'saving' || !clientId}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Guardar cheque
          </button>
        </div>
      </div>
    </form>
  );
}

export function Checks() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [checksResult, clientsResult] = await Promise.all([
      supabase.from('checks').select('*').order('due_date', { ascending: true }),
      supabase.from('clients').select('*').order('name'),
    ]);
    setChecks((checksResult.data ?? []) as Check[]);
    setClients((clientsResult.data ?? []) as Client[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    loadData();
  }

  async function updateStatus(check: Check, newStatus: CheckStatus) {
    setUpdatingId(check.id);
    await supabase.from('checks').update({ status: newStatus }).eq('id', check.id);
    setUpdatingId(null);
    loadData();
  }

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));

  const filteredChecks = checks.filter((check) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const clientName = clientsById[check.client_id]?.name ?? '';
    return (
      clientName.toLowerCase().includes(term) ||
      check.bank.toLowerCase().includes(term) ||
      check.check_number.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Valores</h1>
        <button
          onClick={() => setShowForm(true)}
          disabled={clients.length === 0}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
        >
          <Plus size={16} />
          Nuevo cheque
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, banco o N.º de cheque..."
          className="w-full rounded-lg border border-gray-700 bg-gray-900 pl-9 pr-3 py-2 text-white"
        />
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Nuevo cheque</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <NewCheckForm clients={clients} onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-400">Cargando cheques...</p>
        ) : checks.length === 0 ? (
          <p className="p-5 text-gray-400">No hay cheques cargados todavía.</p>
        ) : filteredChecks.length === 0 ? (
          <p className="p-5 text-gray-400">Ningún cheque coincide con la búsqueda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Banco</th>
                <th className="px-5 py-3">N.º</th>
                <th className="px-5 py-3">Monto</th>
                <th className="px-5 py-3">Recibido</th>
                <th className="px-5 py-3">Cobro</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredChecks.map((check) => (
                <tr key={check.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3 text-white font-medium">{clientsById[check.client_id]?.name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-300">{check.bank}</td>
                  <td className="px-5 py-3 text-gray-300">{check.check_number}</td>
                  <td className="px-5 py-3 text-gray-300">${check.amount.toFixed(2)}</td>
                  <td className="px-5 py-3 text-gray-400">{new Date(check.issue_date).toLocaleDateString('es-AR')}</td>
                  <td className={`px-5 py-3 ${isOverdue(check) ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                    {new Date(check.due_date).toLocaleDateString('es-AR')}
                    {isOverdue(check) && ' (vencido)'}
                  </td>
                  <td className="px-5 py-3 text-gray-300">{check.is_deferred ? 'Diferido' : 'Común'}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[check.status]}`}>
                      {statusLabels[check.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {nextStatuses[check.status].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => updateStatus(check, option.value)}
                          disabled={updatingId === check.id}
                          className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-50"
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
