import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { SaveStatus } from './SaveStatusIndicator';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import type { Category, Product, Supplier } from '../types';

interface ProductFormProps {
  product?: Product;
  categories: Category[];
  suppliers: Supplier[];
  onSaved: () => void;
  onCancel: () => void;
}

export function ProductForm({ product, categories, suppliers, onSaved, onCancel }: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? '');
  const [bulkUnit, setBulkUnit] = useState(product?.bulk_unit ?? '');
  const [retailUnit, setRetailUnit] = useState(product?.retail_unit ?? '');
  const [conversionFactor, setConversionFactor] = useState(String(product?.conversion_factor ?? 1));
  const [minStockAlert, setMinStockAlert] = useState(String(product?.min_stock_alert ?? 0));
  const [price, setPrice] = useState(String(product?.price ?? 0));
  const [categoryId, setCategoryId] = useState(product?.category_id ?? '');
  const [supplierId, setSupplierId] = useState(product?.supplier_id ?? '');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const payload = {
      name,
      bulk_unit: bulkUnit,
      retail_unit: retailUnit,
      conversion_factor: Number(conversionFactor),
      min_stock_alert: Number(minStockAlert),
      price: Number(price),
      category_id: categoryId || null,
      supplier_id: supplierId || null,
    };

    const { error } = product
      ? await supabase.from('products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert({ ...payload, current_stock: 0 });

    if (error) {
      setStatus('error');
      setErrorMessage('No se pudo guardar el producto. Verificá tu conexión.');
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
          placeholder="Cemento Loma Negra"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Categoría</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          >
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Proveedor</label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          >
            <option value="">Sin proveedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Unidad a granel</label>
          <input
            required
            value={bulkUnit}
            onChange={(e) => setBulkUnit(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
            placeholder="bolsa"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Unidad minorista</label>
          <input
            required
            value={retailUnit}
            onChange={(e) => setRetailUnit(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
            placeholder="kg"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Factor de conversión (retail por 1 bulk)
        </label>
        <input
          required
          type="number"
          step="any"
          value={conversionFactor}
          onChange={(e) => setConversionFactor(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          placeholder="25"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Alerta de stock mínimo</label>
          <input
            type="number"
            step="any"
            value={minStockAlert}
            onChange={(e) => setMinStockAlert(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Precio</label>
          <input
            type="number"
            step="any"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
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
            {product ? 'Guardar cambios' : 'Guardar producto'}
          </button>
        </div>
      </div>
    </form>
  );
}
