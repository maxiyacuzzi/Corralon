import type { Product } from '../types';

/** Convierte una cantidad en unidad a granel (bulk_unit) a unidad minorista (retail_unit). */
export function bulkToRetail(product: Pick<Product, 'conversion_factor'>, bulkQuantity: number): number {
  return bulkQuantity * product.conversion_factor;
}

/** Convierte una cantidad en unidad minorista (retail_unit) a unidad a granel (bulk_unit). */
export function retailToBulk(product: Pick<Product, 'conversion_factor'>, retailQuantity: number): number {
  if (product.conversion_factor === 0) return 0;
  return retailQuantity / product.conversion_factor;
}

/** Formatea una cantidad en retail_unit mostrando también su equivalente en bulk_unit. */
export function formatStock(product: Pick<Product, 'retail_unit' | 'bulk_unit' | 'conversion_factor'>, retailQuantity: number): string {
  const bulk = retailToBulk(product, retailQuantity);
  return `${retailQuantity} ${product.retail_unit} (${bulk.toFixed(2)} ${product.bulk_unit})`;
}

export function stockStatus(product: Pick<Product, 'current_stock' | 'min_stock_alert'>): 'ok' | 'low' | 'empty' {
  if (product.current_stock <= 0) return 'empty';
  if (product.current_stock <= product.min_stock_alert) return 'low';
  return 'ok';
}
