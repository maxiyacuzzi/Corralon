import { useState, type RefObject } from 'react';
import { MessageCircle } from 'lucide-react';
import { elementToPdfFile } from '../lib/pdf';

interface WhatsAppWebButtonProps {
  targetRef: RefObject<HTMLElement | null>;
  fileName: string;
  phone: string | null;
  message: string;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function WhatsAppWebButton({ targetRef, fileName, phone, message }: WhatsAppWebButtonProps) {
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();
  const digits = phone ? normalizePhone(phone) : '';

  async function handleClick() {
    if (!targetRef.current) return;
    setWorking(true);
    setErrorMessage(undefined);

    try {
      const file = await elementToPdfFile(targetRef.current, fileName);

      // Descarga el PDF: WhatsApp Web no permite adjuntar un archivo vía link,
      // así que queda listo para arrastrarlo al chat que se abre a continuación.
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);

      const waUrl = digits
        ? `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}`
        : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('No se pudo abrir WhatsApp Web:', error);
      setErrorMessage('No se pudo generar el PDF. Intentá nuevamente.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="print:hidden flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={working}
        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-gray-900 dark:text-white hover:bg-green-500 disabled:opacity-50"
      >
        <MessageCircle size={16} />
        {working ? 'Generando PDF...' : 'Abrir WhatsApp Web'}
      </button>
      {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
      {!digits && <p className="text-xs text-gray-400 dark:text-gray-500">Cliente sin teléfono cargado — se abre sin destinatario.</p>}
    </div>
  );
}
