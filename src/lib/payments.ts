import type { Sale } from '../types';

export const paymentLabels: Record<Sale['payment_method'], string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  checks: 'Valores',
  mixed: 'Mixto',
};
