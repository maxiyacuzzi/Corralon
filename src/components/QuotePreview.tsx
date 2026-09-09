import { formatCurrency } from '../lib/format';
import type { Client, Product, Quote } from '../types';

interface QuotePreviewProps {
  quote: Quote;
  client: Client;
  productsById: Record<string, Product>;
}

const statusLabels: Record<Quote['status'], string> = {
  draft: 'Borrador',
  approved: 'Aprobado',
  expired: 'Vencido',
  converted: 'Convertido',
};

export function QuotePreview({ quote, client, productsById }: QuotePreviewProps) {
  const subtotal = quote.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const total = subtotal * (1 - quote.discount_percent / 100);

  return (
    <div className="bg-white text-gray-900 border border-gray-200 rounded-xl p-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between border-b border-gray-200 pb-4 mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Presupuesto</h2>
          <p className="text-gray-500">Estado: {statusLabels[quote.status]}</p>
        </div>
        <div className="text-right">
          <p className="text-gray-500">{new Date(quote.created_at).toLocaleDateString('es-AR')}</p>
          {quote.valid_until && (
            <p className="text-sm text-gray-500">
              Válido hasta {new Date(quote.valid_until).toLocaleDateString('es-AR')}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-500">Cliente</p>
        <p className="text-gray-900 font-medium">{client.name}</p>
        {client.tax_id && <p className="text-sm text-gray-500">CUIT/DNI: {client.tax_id}</p>}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="pb-2">Producto</th>
            <th className="pb-2 text-right">Cantidad</th>
            <th className="pb-2 text-right">Precio unit.</th>
            <th className="pb-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {quote.items.map((item, index) => {
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

      <div className="flex flex-col items-end gap-1 mt-4 pt-4 border-t border-gray-200">
        <p className="text-gray-500">Subtotal: {formatCurrency(subtotal)}</p>
        {quote.discount_percent > 0 && (
          <p className="text-gray-500">Descuento por pago en efectivo: -{quote.discount_percent}%</p>
        )}
        <p className="text-lg font-semibold text-gray-900">Total: {formatCurrency(total)}</p>
      </div>
    </div>
  );
}
