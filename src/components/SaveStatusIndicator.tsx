export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function SaveStatusIndicator({ status, errorMessage }: { status: SaveStatus; errorMessage?: string }) {
  if (status === 'idle') return null;

  const config: Record<Exclude<SaveStatus, 'idle'>, { text: string; className: string }> = {
    saving: { text: 'Guardando...', className: 'text-gray-500 dark:text-gray-400' },
    saved: { text: 'Guardado', className: 'text-green-500' },
    error: { text: errorMessage ?? 'Error de conexión', className: 'text-red-500' },
  };

  const { text, className } = config[status];

  return <p className={`text-sm font-medium ${className}`}>{text}</p>;
}
