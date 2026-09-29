import type { PurchasePaymentMethod, Sale } from '../types';

export const paymentLabels: Record<Sale['payment_method'], string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  checks: 'Valores',
  mixed: 'Mixto',
};

export const purchasePaymentLabels: Record<PurchasePaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  checks: 'Valores',
  account: 'Cuenta corriente',
};
