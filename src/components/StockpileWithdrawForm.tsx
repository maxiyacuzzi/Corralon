import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Product, Stockpile } from '../types';
import type { SaveStatus } from './SaveStatusIndicator';
import { SaveStatusIndicator } from './SaveStatusIndicator';

interface StockpileWithdrawFormProps {
  stockpile: Stockpile;
  product: Product;
  onSaved: () => void;
  onCancel: () => void;
}

export function StockpileWithdrawForm({ stockpile, product, onSaved, onCancel }: StockpileWithdrawFormProps) {
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { data, error } = await supabase.functions.invoke('withdraw-stockpile', {
      body: {
        stockpile_id: stockpile.id,
        quantity: Number(quantity),
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
      <p className="text-sm text-gray-400">
        Saldo disponible: <span className="text-white font-medium">{stockpile.remaining} {product.retail_unit}</span>
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Cantidad a retirar ({product.retail_unit})</label>
        <input
          required
          type="number"
          step="any"
          max={stockpile.remaining}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
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
            disabled={status === 'saving'}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Confirmar retiro
          </button>
        </div>
      </div>
    </form>
  );
}
