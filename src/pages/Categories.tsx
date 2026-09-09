import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { orderCategoriesByHierarchy } from '../lib/categories';
import type { Category } from '../types';

function NewCategoryForm({
  parent,
  onSaved,
  onCancel,
}: {
  parent: Category | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { error } = await supabase.from('categories').insert({ name, parent_id: parent?.id ?? null });

    if (error) {
      setStatus('error');
      setErrorMessage(
        error.message.includes('duplicate') ? 'Ya existe una categoría con ese nombre.' : 'No se pudo guardar la categoría. Verificá tu conexión.'
      );
      return;
    }

    setStatus('saved');
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">
          {parent ? `Nombre de la subcategoría de "${parent.name}"` : 'Nombre'}
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          placeholder={parent ? 'Cemento' : 'Cementos y morteros'}
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
            {parent ? 'Guardar subcategoría' : 'Guardar categoría'}
          </button>
        </div>
      </div>
    </form>
  );
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subcategoryParent, setSubcategoryParent] = useState<Category | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories((data ?? []) as Category[]);
    setLoading(false);
  }

  function handleSaved() {
    setShowForm(false);
    setSubcategoryParent(null);
    loadCategories();
  }

  function closeForm() {
    setShowForm(false);
    setSubcategoryParent(null);
  }

  const isFormOpen = showForm || subcategoryParent !== null;
  const orderedCategories = orderCategoriesByHierarchy(categories);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Categorías</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-orange-500"
        >
          <Plus size={16} />
          Nueva categoría
        </button>
      </div>

      {isFormOpen && (
        <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              {subcategoryParent ? 'Nueva subcategoría' : 'Nueva categoría'}
            </h2>
            <button onClick={closeForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          <NewCategoryForm parent={subcategoryParent} onSaved={handleSaved} onCancel={closeForm} />
        </div>
      )}

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Cargando categorías...</p>
        ) : categories.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">No hay categorías cargadas todavía.</p>
        ) : (
          orderedCategories.map(({ category, depth }) => (
            <div
              key={category.id}
              className={`flex items-center justify-between px-5 py-3 ${depth > 0 ? 'pl-10' : ''}`}
            >
              <span className={depth > 0 ? 'text-gray-600 dark:text-gray-300 text-sm' : 'text-gray-900 dark:text-white font-medium'}>
                {depth > 0 ? `↳ ${category.name}` : category.name}
              </span>
              {depth === 0 && (
                <button
                  onClick={() => setSubcategoryParent(category)}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  <Plus size={14} />
                  Subcategoría
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
