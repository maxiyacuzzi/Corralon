import { paymentLabels } from '../lib/payments';
import { formatCurrency } from '../lib/format';
import type { Client, DeliveryNote, Product, Sale, SalePayment } from '../types';

interface SalePreviewProps {
  sale: Sale;
  client: Client;
  deliveryNotes: DeliveryNote[];
  payments: SalePayment[];
  productsById: Record<string, Product>;
}

export function SalePreview({ sale, client, deliveryNotes, payments, productsById }: SalePreviewProps) {
  return (
    <div className="bg-white text-gray-900 border border-gray-200 rounded-xl p-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between border-b border-gray-200 pb-4 mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Comprobante de venta</h2>
          <p className="text-gray-500">{sale.is_formal ? 'Comprobante formal' : 'Comprobante informal'}</p>
        </div>
        <p className="text-gray-500">{new Date(sale.created_at).toLocaleDateString('es-AR')}</p>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-500">Cliente</p>
        <p className="text-gray-900 font-medium">{client.name}</p>
        {client.tax_id && <p className="text-sm text-gray-500">CUIT/DNI: {client.tax_id}</p>}
      </div>

      {deliveryNotes.length > 0 && (
        <div className="mb-6 text-sm">
          <p className="text-gray-500">Remitos incluidos</p>
          <p className="text-gray-900 font-medium">
            {deliveryNotes.map((note) => String(note.number).padStart(6, '0')).join(', ')}
          </p>
        </div>
      )}

      {sale.items && sale.items.length > 0 && (
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="pb-2">Producto</th>
              <th className="pb-2 text-right">Cantidad</th>
              <th className="pb-2 text-right">Precio unit.</th>
              <th className="pb-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => {
              const product = productsById[item.product_id];
              return (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2 text-gray-900">{product?.name ?? item.product_id}</td>
                  <td className="py-2 text-right text-gray-900">
                    {item.quantity} {product?.retail_unit ?? ''}
                  </td>
                  <td className="py-2 text-right text-gray-900">{formatCurrency(item.unit_price)}</td>
                  <td className="py-2 text-right text-gray-900">{formatCurrency(item.quantity * item.unit_price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2">Forma de pago</th>
            <th className="pb-2 text-right">Descuento</th>
            <th className="pb-2 text-right">Monto</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b border-gray-100">
              <td className="py-2 text-gray-900">{paymentLabels[payment.method]}</td>
              <td className="py-2 text-right text-gray-900">
                {payment.discount_percent > 0 ? `-${payment.discount_percent}%` : '—'}
              </td>
              <td className="py-2 text-right text-gray-900">{formatCurrency(payment.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
        <p className="text-lg font-semibold text-gray-900">Total: {formatCurrency(sale.total_amount)}</p>
      </div>
    </div>
  );
}
