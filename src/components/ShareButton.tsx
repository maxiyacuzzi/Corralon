import { useState, type RefObject } from 'react';
import { Share2 } from 'lucide-react';
import { elementToPdfFile } from '../lib/pdf';

interface ShareButtonProps {
  targetRef: RefObject<HTMLElement | null>;
  fileName: string;
  shareTitle: string;
  shareText?: string;
}

export function ShareButton({ targetRef, fileName, shareTitle, shareText }: ShareButtonProps) {
  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleShare() {
    if (!targetRef.current) return;
    setWorking(true);
    setErrorMessage(undefined);

    try {
      const file = await elementToPdfFile(targetRef.current, fileName);

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: shareTitle, text: shareText });
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      if ((error as Error)?.name !== 'AbortError') {
        console.error('No se pudo generar/compartir el PDF:', error);
        setErrorMessage('No se pudo generar el PDF. Intentá nuevamente.');
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="print:hidden flex flex-col items-end gap-1">
      <button
        onClick={handleShare}
        disabled={working}
        className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50"
      >
        <Share2 size={16} />
        {working ? 'Generando PDF...' : 'Compartir'}
      </button>
      {errorMessage && <p className="text-xs text-red-500">{errorMessage}</p>}
    </div>
  );
}
