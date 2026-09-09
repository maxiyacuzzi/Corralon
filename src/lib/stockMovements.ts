import type { StockMovement } from '../types';

export const movementLabels: Record<StockMovement['type'], string> = {
  purchase_in: 'Ingreso por compra',
  sale_out: 'Venta',
  stockpile_out: 'Retiro de acopio',
  adjustment: 'Ajuste manual',
};
