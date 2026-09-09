import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { bulkToRetail, formatStock } from '../lib/units';
import type { Product, Stockpile } from '../types';
import type { SaveStatus } from './SaveStatusIndicator';
import { SaveStatusIndicator } from './SaveStatusIndicator';

interface StockpileWithdrawFormProps {
  stockpile: Stockpile;
  product: Product;
  onSaved: () => void;
  onCancel: () => void;
}

type LoadUnit = 'bulk' | 'retail';

export function StockpileWithdrawForm({ stockpile, product, onSaved, onCancel }: StockpileWithdrawFormProps) {
  const showUnitToggle = product.bulk_unit !== product.retail_unit;
  const [unit, setUnit] = useState<LoadUnit>(showUnitToggle ? 'bulk' : 'retail');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  const enteredQuantity = Number(quantity) || 0;
  const retailQuantity = showUnitToggle && unit === 'bulk' ? bulkToRetail(product, enteredQuantity) : enteredQuantity;
  const exceedsRemaining = retailQuantity > stockpile.remaining;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { data, error } = await supabase.functions.invoke('withdraw-stockpile', {
      body: {
        stockpile_id: stockpile.id,
        quantity: retailQuantity,
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
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Saldo disponible: <span className="text-gray-900 dark:text-white font-medium">{formatStock(product, stockpile.remaining)}</span>
      </p>

      <div className={showUnitToggle ? 'grid grid-cols-2 gap-4' : ''}>
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
            Cantidad a retirar {!showUnitToggle ? `(${product.retail_unit})` : ''}
          </label>
          <input
            required
            type="number"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          />
        </div>
        {showUnitToggle && (
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Unidad</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as LoadUnit)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
            >
              <option value="bulk">{product.bulk_unit}</option>
              <option value="retail">{product.retail_unit}</option>
            </select>
          </div>
        )}
      </div>

      {showUnitToggle && unit === 'bulk' && quantity && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Equivale a <span className="text-gray-900 dark:text-white font-medium">{retailQuantity} {product.retail_unit}</span>
        </p>
      )}

      {quantity && exceedsRemaining && <p className="text-sm text-red-500">Supera el saldo disponible.</p>}

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
            disabled={status === 'saving' || retailQuantity <= 0 || exceedsRemaining}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Confirmar retiro
          </button>
        </div>
      </div>
    </form>
  );
}
