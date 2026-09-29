export function formatCurrency(value: number) {
  return `$${value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Para columnas `date` de Postgres ('YYYY-MM-DD'). `new Date('2026-01-20')` se interpreta
// como medianoche UTC y en Argentina (UTC-3) se muestra como el día anterior.
export function formatDateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-AR');
}

// Cuenta corriente con un proveedor: positivo = le debemos, negativo = saldo a nuestro favor.
export function supplierBalanceLabel(balance: number) {
  if (balance > 0) return `le debés ${formatCurrency(balance)}`;
  if (balance < 0) return `saldo a tu favor ${formatCurrency(-balance)}`;
  return 'al día';
}
