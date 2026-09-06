import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Product, StockMovement } from '../types';
import type { SaveStatus } from './SaveStatusIndicator';
import { SaveStatusIndicator } from './SaveStatusIndicator';

interface StockMovementFormProps {
  products: Product[];
  onSaved: () => void;
  onCancel: () => void;
}

const MOVEMENT_TYPES: { value: StockMovement['type']; label: string }[] = [
  { value: 'purchase_in', label: 'Ingreso por compra' },
  { value: 'adjustment', label: 'Ajuste manual' },
];

export function StockMovementForm({ products, onSaved, onCancel }: StockMovementFormProps) {
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [type, setType] = useState<StockMovement['type']>('purchase_in');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const signedQuantity = type === 'adjustment' ? Number(quantity) : Math.abs(Number(quantity));

    const { data, error } = await supabase.functions.invoke('register-stock-movement', {
      body: {
        product_id: productId,
        type,
        quantity: signedQuantity,
        reference_id: null,
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
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Producto</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
        >
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Tipo de movimiento</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as StockMovement['type'])}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
        >
          {MOVEMENT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Cantidad {type === 'adjustment' ? '(puede ser negativa)' : ''}
        </label>
        <input
          required
          type="number"
          step="any"
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
            disabled={status === 'saving' || !productId}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
          >
            Registrar movimiento
          </button>
        </div>
      </div>
    </form>
  );
}
