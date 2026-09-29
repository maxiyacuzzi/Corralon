import { formatStock } from '../lib/units';
import type { Client, DeliveryNote, Product } from '../types';

interface DeliveryNotePreviewProps {
  deliveryNote: DeliveryNote;
  client: Client;
  productsById: Record<string, Product>;
}

export function DeliveryNotePreview({ deliveryNote, client, productsById }: DeliveryNotePreviewProps) {
  return (
    <div className="bg-white paper-dark:bg-gray-800 text-gray-900 paper-dark:text-white border border-gray-200 paper-dark:border-gray-700 rounded-xl p-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between border-b border-gray-200 paper-dark:border-gray-700 pb-4 mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 paper-dark:text-white">Remito</h2>
          <p className="text-gray-500 paper-dark:text-gray-400">N.º {String(deliveryNote.number).padStart(6, '0')}</p>
        </div>
        <p className="text-gray-500 paper-dark:text-gray-400">{new Date(deliveryNote.created_at).toLocaleDateString('es-AR')}</p>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-500 paper-dark:text-gray-400">Cliente</p>
        <p className="text-gray-900 paper-dark:text-white font-medium">{client.name}</p>
        {client.tax_id && <p className="text-sm text-gray-500 paper-dark:text-gray-400">CUIT/DNI: {client.tax_id}</p>}
        {deliveryNote.delivery_address && (
          <p className="text-sm text-gray-500 paper-dark:text-gray-400 mt-1">Entregar en: <span className="text-gray-900 paper-dark:text-white">{deliveryNote.delivery_address}</span></p>
        )}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 paper-dark:text-gray-400 border-b border-gray-200 paper-dark:border-gray-700">
            <th className="pb-2">Producto</th>
            <th className="pb-2 text-right">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {deliveryNote.items.map((item, index) => {
            const product = productsById[item.product_id];
            return (
              <tr key={index} className="border-b border-gray-100 paper-dark:border-gray-800">
                <td className="py-2 text-gray-900 paper-dark:text-white">{product?.name ?? item.product_id}</td>
                <td className="py-2 text-right text-gray-900 paper-dark:text-white">
                  {product ? formatStock(product, item.quantity) : item.quantity}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {deliveryNote.stockpile_id && (
        <p className="mt-4 text-sm text-gray-500 paper-dark:text-gray-400">Este remito descuenta saldo de acopio.</p>
      )}
    </div>
  );
}
