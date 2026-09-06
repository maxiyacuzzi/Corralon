import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import type { Client } from '../types';

function NewClientForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { error } = await supabase.from('clients').insert({
      name,
      tax_id: taxId || null,
      phone: phone || null,
      account_balance: 0,
    });

    if (error) {
      setStatus('error');
      setErrorMessage('No se pudo guardar el cliente. Verificá tu conexión.');
      return;
    }

    setStatus('saved');
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Nombre</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">CUIT/DNI</label>
          <input
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Teléfono</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          />
        </div>
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
            disabled={status === 'saving'}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Guardar cliente
          </button>
        </div>
      </div>
    </form>
  );
}

export function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    setLoading(true);
    const { data } = await supabase.from('clients').select('*').order('name');
    setClients((data ?? []) as Client[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    loadClients();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white">Clientes</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
        >
          <Plus size={16} />
          Nuevo cliente
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-white">Nuevo cliente</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
              <X size={18} />
            </button>
          </div>
          <NewClientForm onSaved={handleSaved} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="rounded-xl border border-gray-700 bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-400">Cargando clientes...</p>
        ) : clients.length === 0 ? (
          <p className="p-5 text-gray-400">No hay clientes cargados todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">CUIT/DNI</th>
                <th className="px-5 py-3">Teléfono</th>
                <th className="px-5 py-3">Cuenta corriente</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-gray-800 last:border-0">
                  <td className="px-5 py-3 text-white font-medium">{client.name}</td>
                  <td className="px-5 py-3 text-gray-300">{client.tax_id ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-300">{client.phone ?? '—'}</td>
                  <td className={`px-5 py-3 font-medium ${client.account_balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    ${client.account_balance.toFixed(2)}
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
