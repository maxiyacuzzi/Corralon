import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { editableRowProps, stopRowClick } from '../lib/rowClick';
import type { SaveStatus } from '../components/SaveStatusIndicator';
import { SaveStatusIndicator } from '../components/SaveStatusIndicator';
import { orderCategoriesByHierarchy } from '../lib/categories';
import type { Category } from '../types';

function CategoryForm({
  parent,
  category,
  parentOptions,
  hasSubcategories,
  onSaved,
  onCancel,
}: {
  parent: Category | null; // alta de subcategoría: su categoría padre
  category: Category | null; // edición: la categoría a editar
  parentOptions: Category[]; // edición: categorías de nivel superior elegibles como padre
  hasSubcategories: boolean; // edición: si tiene subcategorías no puede pasar a ser subcategoría (un solo nivel)
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [parentId, setParentId] = useState(category?.parent_id ?? '');
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage(undefined);

    const { error } = category
      ? await supabase.from('categories').update({ name, parent_id: parentId || null }).eq('id', category.id)
      : await supabase.from('categories').insert({ name, parent_id: parent?.id ?? null });

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

      {category && !hasSubcategories && (
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">Categoría padre</label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
          >
            <option value="">Ninguna (categoría principal)</option>
            {parentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
            {category ? 'Guardar cambios' : parent ? 'Guardar subcategoría' : 'Guardar categoría'}
          </button>
        </div>
      </div>
    </form>
  );
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCategoryIds, setProductCategoryIds] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subcategoryParent, setSubcategoryParent] = useState<Category | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string>();

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    const [categoriesResult, productsResult] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('products').select('category_id'),
    ]);
    setCategories((categoriesResult.data ?? []) as Category[]);
    setProductCategoryIds(((productsResult.data ?? []) as { category_id: string | null }[]).map((p) => p.category_id));
    setLoading(false);
  }

  function handleSaved() {
    closeForm();
    loadCategories();
  }

  function closeForm() {
    setShowForm(false);
    setSubcategoryParent(null);
    setEditingCategory(null);
  }

  function openForm(open: () => void) {
    closeForm();
    setConfirmingDeleteId(null);
    open();
  }

  async function deleteCategory(category: Category) {
    setDeletingId(category.id);
    setDeleteError(undefined);
    // .select() devuelve las filas borradas: si RLS no deja borrar, no hay error pero vuelve vacío.
    const { data, error } = await supabase.from('categories').delete().eq('id', category.id).select();
    setDeletingId(null);
    if (error || !data || data.length === 0) {
      setDeleteError(`No se pudo eliminar "${category.name}". Verificá tu conexión.`);
      return;
    }
    setConfirmingDeleteId(null);
    loadCategories();
  }

  const isFormOpen = showForm || subcategoryParent !== null || editingCategory !== null;
  const orderedCategories = orderCategoriesByHierarchy(categories);
  const subcategoriesOf = (id: string) => categories.filter((c) => c.parent_id === id);
  const productCountOf = (ids: string[]) => productCategoryIds.filter((id) => id !== null && ids.includes(id)).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Categorías</h1>
        <button
          onClick={() => openForm(() => setShowForm(true))}
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
              {editingCategory ? 'Editar categoría' : subcategoryParent ? 'Nueva subcategoría' : 'Nueva categoría'}
            </h2>
            <button onClick={closeForm} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
              <X size={18} />
            </button>
          </div>
          <CategoryForm
            key={editingCategory?.id ?? subcategoryParent?.id ?? 'new'}
            parent={subcategoryParent}
            category={editingCategory}
            parentOptions={categories.filter((c) => c.parent_id === null && c.id !== editingCategory?.id)}
            hasSubcategories={editingCategory ? subcategoriesOf(editingCategory.id).length > 0 : false}
            onSaved={handleSaved}
            onCancel={closeForm}
          />
        </div>
      )}

      {deleteError && <p className="text-sm text-red-500">{deleteError}</p>}

      <div className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-800 overflow-x-auto">
        {loading ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">Cargando categorías...</p>
        ) : categories.length === 0 ? (
          <p className="p-5 text-gray-500 dark:text-gray-400">No hay categorías cargadas todavía.</p>
        ) : (
          orderedCategories.map(({ category, depth }) => {
            const subcategories = subcategoriesOf(category.id);
            const affectedProducts = productCountOf([category.id, ...subcategories.map((s) => s.id)]);
            const rowProps = editableRowProps(() => openForm(() => setEditingCategory(category)));
            return (
              <div key={category.id} {...rowProps} className={`px-5 py-3 ${depth > 0 ? 'pl-10' : ''} ${rowProps.className}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={depth > 0 ? 'text-gray-600 dark:text-gray-300 text-sm' : 'text-gray-900 dark:text-white font-medium'}>
                    {depth > 0 ? `↳ ${category.name}` : category.name}
                  </span>
                  <div className="flex items-center gap-2 cursor-default" onClick={stopRowClick}>
                    {depth === 0 && (
                      <button
                        onClick={() => openForm(() => setSubcategoryParent(category))}
                        className="flex items-center gap-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 px-3 py-1.5 text-xs font-medium text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        <Plus size={14} />
                        Subcategoría
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setDeleteError(undefined);
                        setConfirmingDeleteId(category.id);
                      }}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} />
                      Eliminar
                    </button>
                  </div>
                </div>

                {confirmingDeleteId === category.id && (
                  <div
                    onClick={stopRowClick}
                    className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/5 px-4 py-3 cursor-default"
                  >
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      ¿Eliminar "{category.name}"?
                      {subcategories.length === 1 && ' También se elimina su subcategoría.'}
                      {subcategories.length > 1 && ` También se eliminan sus ${subcategories.length} subcategorías.`}
                      {affectedProducts > 0 && ` ${plural(affectedProducts, 'producto queda', 'productos quedan')} sin categoría.`}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmingDeleteId(null)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => deleteCategory(category)}
                        disabled={deletingId === category.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        Sí, eliminar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
