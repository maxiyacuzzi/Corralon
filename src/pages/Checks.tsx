import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { editableRowProps, stopRowClick } from '../lib/rowClick';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { formatCurrency, formatDateOnly, supplierBalanceLabel } from '../lib/format';
import type { Check, CheckStatus, Client, OwnCheck, OwnCheckStatus, Supplier } from '../types';

const statusLabels: Record<CheckStatus, string> = {
  in_wallet: 'En cartera',
  deposited: 'Depositado',
  cleared: 'Cobrado',
  rejected: 'Rechazado',
  delivered: 'Entregado a proveedor',
  returned: 'Devuelto',
};

const statusStyles: Record<CheckStatus, string> = {
  in_wallet: 'bg-gray-500/10 text-gray-500 dark:text-gray-400',
  deposited: 'bg-yellow-500/10 text-yellow-500',
  cleared: 'bg-green-500/10 text-green-500',
  rejected: 'bg-red-500/10 text-red-500',
  delivered: 'bg-orange-500/10 text-orange-500',
  returned: 'bg-red-500/10 text-red-500',
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
  // Entregado: el proveedor lo cobra, o te lo devuelve / te avisa que lo rechazaron.
  delivered: [
    { value: 'cleared', label: 'Marcar cobrado' },
    { value: 'returned', label: 'Marcar devuelto' },
    { value: 'rejected', label: 'Marcar rechazado' },
  ],
  returned: [],
};

// Estos cambios mueven saldos: piden datos o confirmación antes de guardarse.
const statusesNeedingConfirmation: CheckStatus[] = ['delivered', 'rejected', 'returned'];

function isOverdue(check: Check): boolean {
  return (check.status === 'in_wallet' || check.status === 'deposited') && check.due_date < new Date().toISOString().slice(0, 10);
}

const ownStatusLabels: Record<OwnCheckStatus, string> = {
  pending: 'Pendiente',
  covered: 'Cubierto',
  rejected: 'Rechazado',
};

const ownStatusStyles: Record<OwnCheckStatus, string> = {
  pending: 'bg-gray-500/10 text-gray-500 dark:text-gray-400',
  covered: 'bg-green-500/10 text-green-500',
  rejected: 'bg-red-500/10 text-red-500',
};

const ownNextStatuses: Record<OwnCheckStatus, { value: OwnCheckStatus; label: string }[]> = {
  pending: [
    { value: 'covered', label: 'Marcar cubierto' },
    { value: 'rejected', label: 'Marcar rechazado' },
  ],
  covered: [],
  rejected: [],
};

function isOwnCheckOverdue(check: OwnCheck): boolean {
  return check.status === 'pending' && check.due_date < new Date().toISOString().slice(0, 10);
}

// Cuenta corriente: positivo = el cliente debe, negativo = saldo a favor del cliente.
function balanceLabel(balance: number): string {
  if (balance > 0) return `debe ${formatCurrency(balance)}`;
  if (balance < 0) return `saldo a favor ${formatCurrency(-balance)}`;
  return 'al día';
}

// Monto y cliente solo se editan en un cobro a cuenta todavía en cartera: ahí un trigger
// (022) corrige la cuenta corriente. En cheques de venta, o ya depositados/entregados,
// cambiarlos descuadraría la venta o el pago al proveedor.
function canEditAmountAndClient(check: Check) {
  return check.sale_id === null && check.status === 'in_wallet';
}

function CheckForm({
  clients,
  check,
  onSaved,
  onCancel,
}: {
  clients: Client[];
  check?: Check; // si viene, se edita ese cheque
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(check?.client_id ?? clients[0]?.id ?? '');
  const [checkNumber, setCheckNumber] = useState(check?.check_number ?? '');
  const [bank, setBank] = useState(check?.bank ?? '');
  const [holderName, setHolderName] = useState(check?.holder_name ?? '');
  const [holderTaxId, setHolderTaxId] = useState(check?.holder_tax_id ?? '');
  const [emissionDate, setEmissionDate] = useState(check?.emission_date ?? '');
  const [amount, setAmount] = useState(check ? String(check.amount) : '');
  const [issueDate, setIssueDate] = useState(() => check?.issue_date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(check?.due_date ?? '');
  const [isDeferred, setIsDeferred] = useState(check?.is_deferred ?? false);
  const [notes, setNotes] = useState(check?.notes ?? '');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  const amountAndClientEditable = !check || canEditAmountAndClient(check);
  // Los cheques viejos no tienen titular/CUIT/emisión: al editarlos no se obligan, para poder corregir otro dato.
  const requireHolderData = !check;

  const newAmount = Number(amount) || 0;
  const currentBalance = Number(clients.find((c) => c.id === clientId)?.account_balance ?? 0);
  // Al editar, el monto viejo ya está descontado de la cuenta del cliente viejo.
  const alreadyDiscounted = check && check.client_id === clientId ? check.amount : 0;
  const balanceAfter = Math.round((currentBalance + alreadyDiscounted - newAmount) * 100) / 100;
  const balanceChanges = !check || check.client_id !== clientId || check.amount !== newAmount;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const fields = {
      check_number: checkNumber,
      bank,
      holder_name: holderName || null,
      holder_tax_id: holderTaxId || null,
      emission_date: emissionDate || null,
      issue_date: issueDate,
      due_date: dueDate,
      is_deferred: isDeferred,
      notes: notes || null,
    };

    const { error } = check
      ? await supabase
          .from('checks')
          .update(amountAndClientEditable ? { ...fields, client_id: clientId, amount: newAmount } : fields)
          .eq('id', check.id)
      : await supabase.from('checks').insert({ ...fields, client_id: clientId, sale_id: null, amount: newAmount, status: 'in_wallet' });

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
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Cliente (quién lo dio)</label>
          <select
            disabled={!amountAndClientEditable}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white disabled:opacity-60"
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Banco</label>
          <input
            required
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
            placeholder="Banco Galicia"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">N.º de cheque</label>
          <input
            required
            value={checkNumber}
            onChange={(e) => setCheckNumber(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Monto</label>
          <input
            required
            disabled={!amountAndClientEditable}
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white disabled:opacity-60"
          />
        </div>
      </div>

      {!amountAndClientEditable && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {check?.sale_id
            ? 'El monto y el cliente no se pueden cambiar: este cheque vino de una venta.'
            : 'El monto y el cliente solo se pueden cambiar mientras el cheque está en cartera.'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Titular del cheque</label>
          <input
            required={requireHolderData}
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">CUIT del titular</label>
          <input
            required={requireHolderData}
            value={holderTaxId}
            onChange={(e) => setHolderTaxId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
            placeholder="20-12345678-9"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Fecha de emisión</label>
          <input
            required={requireHolderData}
            type="date"
            value={emissionDate}
            onChange={(e) => setEmissionDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Fecha recibido</label>
          <input
            required
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Fecha de cobro</label>
          <input
            required
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <input type="checkbox" checked={isDeferred} onChange={(e) => setIsDeferred(e.target.checked)} />
        Cheque de pago diferido
      </label>

      {clientId && amountAndClientEditable && balanceChanges && (
        <div className="rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            {check
              ? 'Al guardar se corrige la cuenta corriente con el monto y el cliente nuevos.'
              : 'Se registra como cobro a cuenta: entra en Caja y se descuenta de la cuenta corriente del cliente.'}
          </p>
          <p>
            Cuenta corriente actual:{' '}
            <span className={`font-medium ${currentBalance > 0 ? 'text-red-500' : 'text-green-500'}`}>{balanceLabel(currentBalance)}</span>
            {newAmount > 0 && (
              <>
                {check ? ' → después de guardar: ' : ' → después del cheque: '}
                <span className={`font-medium ${balanceAfter > 0 ? 'text-red-500' : 'text-green-500'}`}>{balanceLabel(balanceAfter)}</span>
              </>
            )}
          </p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
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
            disabled={status === 'saving' || !clientId}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {check ? 'Guardar cambios' : 'Guardar cheque'}
          </button>
        </div>
      </div>
    </form>
  );
}

function OwnCheckForm({ check, onSaved, onCancel }: { check?: OwnCheck; onSaved: () => void; onCancel: () => void }) {
  const [payee, setPayee] = useState(check?.payee ?? '');
  const [checkNumber, setCheckNumber] = useState(check?.check_number ?? '');
  const [bank, setBank] = useState(check?.bank ?? '');
  const [amount, setAmount] = useState(check ? String(check.amount) : '');
  const [issueDate, setIssueDate] = useState(() => check?.issue_date ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(check?.due_date ?? '');
  const [notes, setNotes] = useState(check?.notes ?? '');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const fields = {
      payee,
      check_number: checkNumber,
      bank,
      amount: Number(amount),
      issue_date: issueDate,
      due_date: dueDate,
      notes: notes || null,
    };
    // Los cheques emitidos no mueven ningún saldo: se pueden editar completos.
    const { error } = check
      ? await supabase.from('own_checks').update(fields).eq('id', check.id)
      : await supabase.from('own_checks').insert({ ...fields, status: 'pending' });

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
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">A quién se lo diste</label>
          <input
            required
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
            placeholder="Proveedor, persona o empresa"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Banco</label>
          <input
            required
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
            placeholder="Banco Galicia"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">N.º de cheque</label>
          <input
            required
            value={checkNumber}
            onChange={(e) => setCheckNumber(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Monto</label>
          <input
            required
            type="number"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Fecha de emisión</label>
          <input
            required
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Fecha en que hay que cubrirlo</label>
          <input
            required
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Notas (opcional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
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
            disabled={status === 'saving' || !payee}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {check ? 'Guardar cambios' : 'Guardar cheque'}
          </button>
        </div>
      </div>
    </form>
  );
}

function DeliveryPanel({
  check,
  suppliers,
  supplierId,
  asPayment,
  saving,
  onSupplierChange,
  onAsPaymentChange,
  onCancel,
  onConfirm,
}: {
  check: Check;
  suppliers: Supplier[];
  supplierId: string;
  asPayment: boolean;
  saving: boolean;
  onSupplierChange: (id: string) => void;
  onAsPaymentChange: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const supplier = suppliers.find((s) => s.id === supplierId);
  const currentBalance = Number(supplier?.account_balance ?? 0);
  const balanceAfter = Math.round((currentBalance - check.amount) * 100) / 100;

  if (suppliers.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
        Primero cargá al menos un proveedor en la sección Proveedores.
        <button onClick={onCancel} className="text-xs font-medium hover:text-gray-900 dark:hover:text-white">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-orange-500/30 bg-orange-500/5 px-4 py-3">
      <p className="text-sm font-medium text-gray-900 dark:text-white">
        Entregar cheque N.º {check.check_number} ({formatCurrency(check.amount)}) a un proveedor
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm text-gray-600 dark:text-gray-300">
          Proveedor
          <select
            value={supplierId}
            onChange={(e) => onSupplierChange(e.target.value)}
            className="ml-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 text-gray-900 dark:text-white"
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={asPayment} onChange={(e) => onAsPaymentChange(e.target.checked)} />
          Registrar como pago (descuenta de lo que le debés)
        </label>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {asPayment
          ? `Cuenta corriente con ${supplier?.name ?? 'el proveedor'}: ${supplierBalanceLabel(currentBalance)} → ${supplierBalanceLabel(balanceAfter)}`
          : 'Destildalo si el cheque ya se contó como pago de una compra registrada.'}
      </p>
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={saving || !supplierId}
          className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
        >
          Entregar
        </button>
      </div>
    </div>
  );
}

function ReceivedChecks() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<{ check: Check; status: CheckStatus } | null>(null);
  const [deliverySupplierId, setDeliverySupplierId] = useState('');
  const [deliveryAsPayment, setDeliveryAsPayment] = useState(true);
  const [statusError, setStatusError] = useState<string>();
  const [editingCheck, setEditingCheck] = useState<Check | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [checksResult, clientsResult, suppliersResult] = await Promise.all([
      supabase.from('checks').select('*').order('due_date', { ascending: true }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('suppliers').select('*').order('name'),
    ]);
    setChecks((checksResult.data ?? []) as Check[]);
    setClients((clientsResult.data ?? []) as Client[]);
    setSuppliers((suppliersResult.data ?? []) as Supplier[]);
    setLoading(false);
  }

  function handleSaved() {
    closeForm();
    loadData();
  }

  function closeForm() {
    setShowForm(false);
    setEditingCheck(null);
  }

  function requestStatus(check: Check, newStatus: CheckStatus) {
    setStatusError(undefined);
    if (!statusesNeedingConfirmation.includes(newStatus)) {
      updateStatus(check, { status: newStatus });
      return;
    }
    setPending({ check, status: newStatus });
    setDeliverySupplierId(suppliers[0]?.id ?? '');
    setDeliveryAsPayment(true);
  }

  // Los saldos (cliente y proveedor) los mueven triggers en la base al cambiar el estado.
  async function updateStatus(check: Check, patch: Partial<Check>) {
    setUpdatingId(check.id);
    setStatusError(undefined);
    const { error } = await supabase.from('checks').update(patch).eq('id', check.id);
    setUpdatingId(null);
    if (error) {
      setStatusError(`No se pudo actualizar el cheque N.º ${check.check_number}. Verificá tu conexión.`);
      return;
    }
    setPending(null);
    loadData();
  }

  const clientsById = Object.fromEntries(clients.map((c) => [c.id, c]));
  const suppliersById = Object.fromEntries(suppliers.map((s) => [s.id, s]));

  const filteredChecks = checks.filter((check) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const clientName = clientsById[check.client_id]?.name ?? '';
    return (
      clientName.toLowerCase().includes(term) ||
      check.bank.toLowerCase().includes(term) ||
      check.check_number.toLowerCase().includes(term) ||
      (check.holder_name ?? '').toLowerCase().includes(term) ||
      (check.holder_tax_id ?? '').includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, titular, CUIT, banco o N.º de cheque..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 pl-9 pr-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <button
          onClick={() => {
            setEditingCheck(null);
            setShowForm(true);
          }}
          disabled={clients.length === 0}
          className="ml-4 flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
        >
          <Plus size={16} />
          Nuevo cheque
        </button>
      </div>

      {(showForm || editingCheck) && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {editingCheck ? `Editar cheque N.º ${editingCheck.check_number}` : 'Nuevo cheque recibido'}
            </h2>
            <button onClick={closeForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          <CheckForm
            key={editingCheck?.id ?? 'new'}
            clients={clients}
            check={editingCheck ?? undefined}
            onSaved={handleSaved}
            onCancel={closeForm}
          />
        </div>
      )}

      {statusError && <p className="text-sm text-red-500">{statusError}</p>}

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Cargando cheques...</p>
        ) : checks.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">No hay cheques cargados todavía.</p>
        ) : filteredChecks.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Ningún cheque coincide con la búsqueda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                <th className="px-5 py-3">Cliente</th>
                <th className="px-5 py-3">Titular</th>
                <th className="px-5 py-3">Banco</th>
                <th className="px-5 py-3">N.º</th>
                <th className="px-5 py-3">Monto</th>
                <th className="px-5 py-3">Emisión</th>
                <th className="px-5 py-3">Recibido</th>
                <th className="px-5 py-3">Cobro</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredChecks.map((check, index) => {
                const rowProps = editableRowProps(() => {
                  setShowForm(false);
                  setPending(null);
                  setEditingCheck(check);
                });
                return (
                  <Fragment key={check.id}>
                    <tr
                      {...rowProps}
                      className={`border-b-2 border-gray-200 dark:border-gray-700 ${rowProps.className} ${
                        index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-900/40' : ''
                      }`}
                    >
                      <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{clientsById[check.client_id]?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {check.holder_name ?? '—'}
                        {check.holder_tax_id && <span className="block text-xs text-gray-500 dark:text-gray-400">CUIT {check.holder_tax_id}</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{check.bank}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{check.check_number}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{formatCurrency(check.amount)}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">
                        {check.emission_date ? formatDateOnly(check.emission_date) : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatDateOnly(check.issue_date)}</td>
                      <td className={`px-5 py-3 ${isOverdue(check) ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                        {formatDateOnly(check.due_date)}
                        {isOverdue(check) && ' (vencido)'}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{check.is_deferred ? 'Diferido' : 'Común'}</td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ${statusStyles[check.status]}`}>
                          {statusLabels[check.status]}
                        </span>
                        {check.delivered_supplier_id && (
                          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                            → {suppliersById[check.delivered_supplier_id]?.name ?? 'Proveedor eliminado'}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right cursor-default" onClick={stopRowClick}>
                        <div className="flex justify-end gap-2">
                          {nextStatuses[check.status].map((option) => (
                            <button
                              key={option.value}
                              onClick={() => requestStatus(check, option.value)}
                              disabled={updatingId === check.id}
                              className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                    {pending?.check.id === check.id && (
                      <tr className={`border-b-2 border-gray-200 dark:border-gray-700 ${index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-900/40' : ''}`}>
                        <td colSpan={11} className="px-5 py-3">
                          {pending.status === 'delivered' ? (
                            <DeliveryPanel
                              check={check}
                              suppliers={suppliers}
                              supplierId={deliverySupplierId}
                              asPayment={deliveryAsPayment}
                              saving={updatingId === check.id}
                              onSupplierChange={setDeliverySupplierId}
                              onAsPaymentChange={setDeliveryAsPayment}
                              onCancel={() => setPending(null)}
                              onConfirm={() =>
                                updateStatus(check, {
                                  status: 'delivered',
                                  delivered_supplier_id: deliverySupplierId,
                                  delivered_as_payment: deliveryAsPayment,
                                })
                              }
                            />
                          ) : (
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3">
                              <p className="text-sm text-gray-600 dark:text-gray-300">
                                ¿Marcar {pending.status === 'rejected' ? 'rechazado' : 'devuelto'} el cheque N.º {check.check_number}? Se le vuelven a
                                sumar {formatCurrency(check.amount)} a la cuenta corriente de {clientsById[check.client_id]?.name ?? 'el cliente'}.
                                {check.supplier_payment_id &&
                                  ` Además se anula el pago a ${suppliersById[check.delivered_supplier_id ?? '']?.name ?? 'el proveedor'} y le volvés a deber ese monto.`}
                              </p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setPending(null)}
                                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                                >
                                  Cancelar
                                </button>
                                <button
                                  onClick={() => updateStatus(check, { status: pending.status })}
                                  disabled={updatingId === check.id}
                                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                                >
                                  Sí, marcar {pending.status === 'rejected' ? 'rechazado' : 'devuelto'}
                                </button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function IssuedChecks() {
  const [checks, setChecks] = useState<OwnCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCheck, setEditingCheck] = useState<OwnCheck | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from('own_checks').select('*').order('due_date', { ascending: true });
    setChecks((data ?? []) as OwnCheck[]);
    setLoading(false);
  }

  function handleSaved() {
    closeForm();
    loadData();
  }

  function closeForm() {
    setShowForm(false);
    setEditingCheck(null);
  }

  async function updateStatus(check: OwnCheck, newStatus: OwnCheckStatus) {
    setUpdatingId(check.id);
    await supabase.from('own_checks').update({ status: newStatus }).eq('id', check.id);
    setUpdatingId(null);
    loadData();
  }

  const filteredChecks = checks.filter((check) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      check.payee.toLowerCase().includes(term) ||
      check.bank.toLowerCase().includes(term) ||
      check.check_number.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por destinatario, banco o N.º de cheque..."
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 pl-9 pr-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        <button
          onClick={() => {
            setEditingCheck(null);
            setShowForm(true);
          }}
          className="ml-4 flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500"
        >
          <Plus size={16} />
          Nuevo cheque
        </button>
      </div>

      {(showForm || editingCheck) && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {editingCheck ? `Editar cheque emitido N.º ${editingCheck.check_number}` : 'Nuevo cheque emitido'}
            </h2>
            <button onClick={closeForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          <OwnCheckForm key={editingCheck?.id ?? 'new'} check={editingCheck ?? undefined} onSaved={handleSaved} onCancel={closeForm} />
        </div>
      )}

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Cargando cheques...</p>
        ) : checks.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">No hay cheques emitidos cargados todavía.</p>
        ) : filteredChecks.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Ningún cheque coincide con la búsqueda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-300 dark:border-gray-700">
                <th className="px-5 py-3">A quién</th>
                <th className="px-5 py-3">Banco</th>
                <th className="px-5 py-3">N.º</th>
                <th className="px-5 py-3">Monto</th>
                <th className="px-5 py-3">Emitido</th>
                <th className="px-5 py-3">Cubrir</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filteredChecks.map((check, index) => {
                const rowProps = editableRowProps(() => {
                  setShowForm(false);
                  setEditingCheck(check);
                });
                return (
                  <tr
                    key={check.id}
                    {...rowProps}
                    className={`border-b-2 border-gray-200 dark:border-gray-700 last:border-0 ${rowProps.className} ${
                      index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-900/40' : ''
                    }`}
                  >
                    <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{check.payee}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{check.bank}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{check.check_number}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{formatCurrency(check.amount)}</td>
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{formatDateOnly(check.issue_date)}</td>
                    <td className={`px-5 py-3 ${isOwnCheckOverdue(check) ? 'text-red-500 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                      {formatDateOnly(check.due_date)}
                      {isOwnCheckOverdue(check) && ' (vencido)'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${ownStatusStyles[check.status]}`}>
                        {ownStatusLabels[check.status]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right cursor-default" onClick={stopRowClick}>
                      <div className="flex justify-end gap-2">
                        {ownNextStatuses[check.status].map((option) => (
                          <button
                            key={option.value}
                            onClick={() => updateStatus(check, option.value)}
                            disabled={updatingId === check.id}
                            className="rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function Checks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'emitidos' ? 'emitidos' : 'recibidos';

  function setTab(next: 'recibidos' | 'emitidos') {
    setSearchParams(next === 'recibidos' ? {} : { tab: next });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Valores</h1>

      <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-1 gap-1">
        <button
          type="button"
          onClick={() => setTab('recibidos')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'recibidos' ? 'bg-orange-600 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Recibidos
        </button>
        <button
          type="button"
          onClick={() => setTab('emitidos')}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === 'emitidos' ? 'bg-orange-600 text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Emitidos
        </button>
      </div>

      {tab === 'recibidos' ? <ReceivedChecks /> : <IssuedChecks />}
    </div>
  );
}
