import type { Category } from '../types';

export interface CategoryOption {
  category: Category;
  depth: number;
}

/** Árbol de categorías aplanado: cada una seguida de sus subcategorías (en todos los niveles), en orden alfabético. */
export function orderCategoriesByHierarchy(categories: Category[]): CategoryOption[] {
  const byParentId = new Map<string | null, Category[]>();
  for (const category of categories) {
    const key = category.parent_id;
    const siblings = byParentId.get(key) ?? [];
    siblings.push(category);
    byParentId.set(key, siblings);
  }
  for (const siblings of byParentId.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name));
  }

  const ordered: CategoryOption[] = [];
  function addChildren(parentId: string | null, depth: number) {
    for (const category of byParentId.get(parentId) ?? []) {
      ordered.push({ category, depth });
      addChildren(category.id, depth + 1);
    }
  }
  addChildren(null, 0);
  return ordered;
}

/** Ruta completa "Abuela / Padre / Subcategoría" (cualquier profundidad) para tablas y búsquedas. */
export function categoryFullName(category: Category, categoriesById: Record<string, Category>): string {
  const names = [category.name];
  const seen = new Set([category.id]);
  let parentId = category.parent_id;
  // `seen` corta si por algún dato corrupto hubiera un ciclo.
  while (parentId && categoriesById[parentId] && !seen.has(parentId)) {
    const parent = categoriesById[parentId];
    names.unshift(parent.name);
    seen.add(parent.id);
    parentId = parent.parent_id;
  }
  return names.join(' / ');
}

/** Ids de todas las subcategorías de una categoría, en todos los niveles (sin incluirla a ella). */
export function descendantIds(categoryId: string, categories: Category[]): string[] {
  const result: string[] = [];
  const pending = [categoryId];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const child of categories.filter((c) => c.parent_id === current)) {
      if (child.id === categoryId || result.includes(child.id)) continue;
      result.push(child.id);
      pending.push(child.id);
    }
  }
  return result;
}

/** Nombre sangrado según el nivel, para usar dentro de un <select>. */
export function indentedCategoryLabel(name: string, depth: number): string {
  return depth === 0 ? name : `${'\u00A0\u00A0\u00A0'.repeat(depth)}↳ ${name}`;
}
