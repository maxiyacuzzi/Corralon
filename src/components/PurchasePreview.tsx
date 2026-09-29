import { purchasePaymentLabels } from '../lib/payments';
import { formatCurrency, formatDateOnly } from '../lib/format';
import type { Product, Purchase, Supplier } from '../types';

interface PurchasePreviewProps {
  purchase: Purchase;
  supplier: Supplier | undefined;
  productsById: Record<string, Product>;
}

// Look "papel" (fondo blanco) a propósito, igual que SalePreview: es la vista que se imprime y se exporta a PDF.
export function PurchasePreview({ purchase, supplier, productsById }: PurchasePreviewProps) {
  const amountPaid = Number(purchase.amount_paid ?? purchase.total_amount);
  const balanceChange = Number(purchase.account_balance_change ?? 0);

  return (
    <div className="bg-white paper-dark:bg-gray-800 text-gray-900 paper-dark:text-white border border-gray-200 paper-dark:border-gray-700 rounded-xl p-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between border-b border-gray-200 paper-dark:border-gray-700 pb-4 mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 paper-dark:text-white">Comprobante de compra</h2>
          <p className="text-gray-500 paper-dark:text-gray-400">Registro interno</p>
        </div>
        <p className="text-gray-500 paper-dark:text-gray-400">{formatDateOnly(purchase.purchase_date)}</p>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-500 paper-dark:text-gray-400">Proveedor</p>
        <p className="text-gray-900 paper-dark:text-white font-medium">{supplier?.name ?? '—'}</p>
        {supplier?.tax_id && <p className="text-sm text-gray-500 paper-dark:text-gray-400">CUIT: {supplier.tax_id}</p>}
        {supplier?.phone && <p className="text-sm text-gray-500 paper-dark:text-gray-400">Teléfono: {supplier.phone}</p>}
      </div>

      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="text-left text-gray-500 paper-dark:text-gray-400 border-b border-gray-200 paper-dark:border-gray-700">
            <th className="pb-2">Producto</th>
            <th className="pb-2 text-right">Cantidad</th>
            <th className="pb-2 text-right">Costo unit.</th>
            <th className="pb-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {purchase.items.map((item, index) => {
            const product = productsById[item.product_id];
            const unit = product ? (item.unit === 'bulk' ? product.bulk_unit : product.retail_unit) : '';
            return (
              <tr key={index} className="border-b border-gray-100 paper-dark:border-gray-800">
                <td className="py-2 text-gray-900 paper-dark:text-white">{product?.name ?? 'Producto eliminado'}</td>
                <td className="py-2 text-right text-gray-900 paper-dark:text-white">
                  {item.quantity.toLocaleString('es-AR')} {unit}
                </td>
                <td className="py-2 text-right text-gray-900 paper-dark:text-white">{formatCurrency(item.unit_cost)}</td>
                <td className="py-2 text-right text-gray-900 paper-dark:text-white">{formatCurrency(item.quantity * item.unit_cost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-end pt-4 border-t border-gray-200 paper-dark:border-gray-700">
        <div className="space-y-1 text-right text-sm">
          <p className="text-lg font-semibold text-gray-900 paper-dark:text-white">Total: {formatCurrency(purchase.total_amount)}</p>
          <p className="text-gray-700 paper-dark:text-gray-300">
            Pagado: {formatCurrency(amountPaid)}
            {amountPaid > 0 && purchase.payment_method !== 'account' && ` (${purchasePaymentLabels[purchase.payment_method]})`}
            {amountPaid === 0 && ' — a cuenta corriente'}
          </p>
          {balanceChange > 0 && <p className="text-gray-700 paper-dark:text-gray-300">Saldo pendiente (a cuenta corriente): {formatCurrency(balanceChange)}</p>}
          {balanceChange < 0 && <p className="text-gray-700 paper-dark:text-gray-300">Saldo a favor: {formatCurrency(-balanceChange)}</p>}
        </div>
      </div>

      {purchase.notes && (
        <div className="mt-6 text-sm">
          <p className="text-gray-500 paper-dark:text-gray-400">Notas</p>
          <p className="text-gray-900 paper-dark:text-white">{purchase.notes}</p>
        </div>
      )}
    </div>
  );
}
