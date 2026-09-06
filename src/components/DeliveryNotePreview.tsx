import type { Client, DeliveryNote, Product } from '../types';

interface DeliveryNotePreviewProps {
  deliveryNote: DeliveryNote;
  client: Client;
  productsById: Record<string, Product>;
}

export function DeliveryNotePreview({ deliveryNote, client, productsById }: DeliveryNotePreviewProps) {
  const total = deliveryNote.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  return (
    <div className="print:bg-white print:text-black bg-gray-800 border border-gray-700 rounded-xl p-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between border-b border-gray-700 pb-4 mb-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Remito</h2>
          <p className="text-gray-400">N.º {String(deliveryNote.number).padStart(6, '0')}</p>
        </div>
        <p className="text-gray-400">{new Date(deliveryNote.created_at).toLocaleDateString('es-AR')}</p>
      </div>

      <div className="mb-6">
        <p className="text-sm text-gray-400">Cliente</p>
        <p className="text-white font-medium">{client.name}</p>
        {client.tax_id && <p className="text-sm text-gray-400">CUIT/DNI: {client.tax_id}</p>}
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-700">
            <th className="pb-2">Producto</th>
            <th className="pb-2 text-right">Cantidad</th>
            <th className="pb-2 text-right">Precio unit.</th>
            <th className="pb-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {deliveryNote.items.map((item, index) => {
            const product = productsById[item.product_id];
            return (
              <tr key={index} className="border-b border-gray-800">
                <td className="py-2 text-white">{product?.name ?? item.product_id}</td>
                <td className="py-2 text-right text-white">
                  {item.quantity} {product?.retail_unit ?? ''}
                </td>
                <td className="py-2 text-right text-white">${item.unit_price.toFixed(2)}</td>
                <td className="py-2 text-right text-white">${(item.quantity * item.unit_price).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-end mt-4 pt-4 border-t border-gray-700">
        <p className="text-lg font-semibold text-white">Total: ${total.toFixed(2)}</p>
      </div>

      {deliveryNote.stockpile_id && (
        <p className="mt-4 text-sm text-gray-400">Este remito descuenta saldo de acopio.</p>
      )}
    </div>
  );
}
