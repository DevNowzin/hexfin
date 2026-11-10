const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(cents: number, showSign = false): string {
  const formatted = currencyFormatter.format(Math.abs(cents) / 100);
  if (!showSign || cents === 0) return cents < 0 ? `- ${formatted}` : formatted;
  return `${cents > 0 ? '+' : '-'} ${formatted}`;
}

export function formatCompactCurrency(cents: number): string {
  const value = cents / 100;
  if (Math.abs(value) < 1000) return formatCurrency(cents);
  return `R$ ${new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
}

export function formatAmountInput(digits: string): string {
  const cents = Number(digits || '0');
  return numberFormatter.format(cents / 100);
}

export function amountInputToCents(digits: string): number {
  return Number.parseInt(digits || '0', 10);
}

export function centsToAmountInput(cents: number): string {
  return String(Math.max(0, Math.round(cents)));
}

export function toDateInput(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date {
  const [year = 1970, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function isValidDateInput(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseLocalDate(value);
  return !Number.isNaN(date.getTime()) && toDateInput(date) === value;
}

export function formatTransactionDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
    .format(parseLocalDate(value))
    .replace('.', '');
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
    .format(parseLocalDate(value))
    .replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

export function formatMonth(monthKey: string, long = true): string {
  const date = parseLocalDate(`${monthKey}-01`);
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: long ? 'long' : 'short',
    year: long ? 'numeric' : undefined,
  }).format(date);
  return formatted.replace('.', '').replace(/^./, (letter) => letter.toUpperCase());
}

export function relativeDayLabel(value: string): string {
  const today = toDateInput();
  if (value === today) return 'Hoje';
  const yesterdayDate = parseLocalDate(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  if (value === toDateInput(yesterdayDate)) return 'Ontem';
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
    .format(parseLocalDate(value))
    .replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

/** Saudação pela hora local: 5–11h bom dia, 12–17h boa tarde, resto boa noite. */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
