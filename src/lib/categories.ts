import type { Category } from '../types';

export interface CategoryOption {
  category: Category;
  depth: number;
}

/** Categorías de nivel superior seguidas de sus subcategorías, en orden alfabético. */
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

/** "Padre / Subcategoría" para mostrar en tablas y búsquedas. */
export function categoryFullName(category: Category, categoriesById: Record<string, Category>): string {
  const parent = category.parent_id ? categoriesById[category.parent_id] : undefined;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}
