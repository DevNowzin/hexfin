// Salário por hora: escala, feriados, faltas e quinzenas (funções puras, testadas). Dinheiro em centavos.
// É só previsão: não cria transação nem mexe em saldo; o salário de verdade entra quando cair na conta.

/** Como foi (ou vai ser) um dia: a escala diz trabalho ou folga; o usuário marca as exceções. */
export type DayMark = 'work' | 'off' | 'absence' | 'late' | 'sick';

export interface WorkSettings {
  hourlyRateCents: number;
  /** Tempo no trabalho por dia, em minutos (entrada à saída). */
  shiftMinutes: number;
  /** Almoço não pago, em minutos. Horas pagas = jornada − almoço. */
  lunchMinutes: number;
  /** Adicional por feriado trabalhado (100 = recebe o dobro no dia). */
  holidayBonusPercent: number;
  /** Conta Carnaval (segunda e terça) e Corpus Christi como feriado. */
  optionalHolidays: boolean;
  /** Primeiro dia do ciclo da escala (`YYYY-MM-DD`). */
  cycleStart: string;
  /** Um item por dia do ciclo: `true` = trabalha. Repete para sempre a partir de `cycleStart`. */
  cycle: boolean[];
  /** Dias que fogem da escala (falta, atraso, atestado, folga ou trabalho extra). */
  overrides: Record<string, DayMark>;
  absencePenaltyCents: number;
  latePenaltyCents: number;
  /** Quanto cai no dia 15 (o resto cai no último dia do mês). 100 = tudo no fim do mês. */
  firstPaymentPercent: number;
  /** Pagamentos (`YYYY-MM:1` ou `YYYY-MM:2`) que o usuário marcou como recebidos antes da data. */
  receivedEarly: string[];
}

export const CYCLE_LENGTHS = [7, 14, 2] as const;

/** Escala inicial: segunda a sábado, folga no domingo (ciclo de 7 dias começando num domingo). */
export function defaultWorkSettings(today: string): WorkSettings {
  const date = parseDay(today);
  const sunday = addDays(today, -date.getDay());
  return {
    hourlyRateCents: 0,
    shiftMinutes: 9 * 60,
    lunchMinutes: 60,
    holidayBonusPercent: 100,
    optionalHolidays: false,
    cycleStart: sunday,
    cycle: [false, true, true, true, true, true, true],
    overrides: {},
    absencePenaltyCents: 0,
    latePenaltyCents: 0,
    firstPaymentPercent: 40,
    receivedEarly: [],
  };
}

function parseDay(value: string): Date {
  const [year = 1970, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function addDays(value: string, days: number): string {
  const date = parseDay(value);
  date.setDate(date.getDate() + days);
  return formatDay(date);
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / (24 * 60 * 60 * 1000));
}

export function daysOfMonth(monthKey: string): string[] {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number);
  const count = new Date(year, month, 0, 12).getDate();
  return Array.from({ length: count }, (_, index) => `${monthKey}-${String(index + 1).padStart(2, '0')}`);
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const FIXED_HOLIDAYS: Array<[string, string]> = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Consciência Negra'],
  ['12-25', 'Natal'],
];

/** Feriados nacionais do ano (data → nome). Carnaval e Corpus Christi são ponto facultativo: só com `optional`. */
export function holidaysOf(year: number, optional: boolean): Map<string, string> {
  const easter = easterSunday(year);
  const holidays = new Map<string, string>(FIXED_HOLIDAYS.map(([day, name]) => [`${year}-${day}`, name]));
  holidays.set(addDays(easter, -2), 'Sexta-feira Santa');
  if (optional) {
    holidays.set(addDays(easter, -48), 'Carnaval');
    holidays.set(addDays(easter, -47), 'Carnaval');
    holidays.set(addDays(easter, 60), 'Corpus Christi');
  }
  return holidays;
}

/** Trabalho ou folga pela escala (sem as marcações). Antes do início do ciclo, conta para trás. */
export function scheduledWork(settings: WorkSettings, day: string): boolean {
  const length = settings.cycle.length;
  if (length === 0) return false;
  const position = ((daysBetween(settings.cycleStart, day) % length) + length) % length;
  return settings.cycle[position] ?? false;
}

export function dayMark(settings: WorkSettings, day: string): DayMark {
  return settings.overrides[day] ?? (scheduledWork(settings, day) ? 'work' : 'off');
}

export function paidMinutesPerDay(settings: WorkSettings): number {
  return Math.max(0, settings.shiftMinutes - settings.lunchMinutes);
}

export interface MonthPay {
  workedDays: number;
  paidMinutes: number;
  holidaysWorked: number;
  absences: number;
  lates: number;
  sickDays: number;
  baseCents: number;
  holidayExtraCents: number;
  penaltiesCents: number;
  totalCents: number;
}

/** Previsão do mês: cada dia trabalhado (ou com atestado) paga as horas do dia; feriado trabalhado ganha o adicional. */
export function computeMonthPay(settings: WorkSettings, monthKey: string): MonthPay {
  const holidays = holidaysOf(Number(monthKey.slice(0, 4)), settings.optionalHolidays);
  const dayCents = Math.round((settings.hourlyRateCents * paidMinutesPerDay(settings)) / 60);
  const pay: MonthPay = {
    workedDays: 0, paidMinutes: 0, holidaysWorked: 0, absences: 0, lates: 0, sickDays: 0,
    baseCents: 0, holidayExtraCents: 0, penaltiesCents: 0, totalCents: 0,
  };
  for (const day of daysOfMonth(monthKey)) {
    const mark = dayMark(settings, day);
    if (mark === 'off') continue;
    if (mark === 'absence') {
      pay.absences += 1;
      pay.penaltiesCents += settings.absencePenaltyCents;
      continue;
    }
    pay.workedDays += 1;
    pay.paidMinutes += paidMinutesPerDay(settings);
    pay.baseCents += dayCents;
    if (mark === 'sick') pay.sickDays += 1;
    if (mark === 'late') {
      pay.lates += 1;
      pay.penaltiesCents += settings.latePenaltyCents;
    }
    if (mark !== 'sick' && holidays.has(day)) {
      pay.holidaysWorked += 1;
      pay.holidayExtraCents += Math.round((dayCents * settings.holidayBonusPercent) / 100);
    }
  }
  pay.totalCents = Math.max(0, pay.baseCents + pay.holidayExtraCents - pay.penaltiesCents);
  return pay;
}

/** Dia de pagamento que cai no domingo ou na segunda é antecipado para o sábado anterior. */
export function adjustPayday(day: string): string {
  const weekday = parseDay(day).getDay();
  if (weekday === 0) return addDays(day, -1);
  if (weekday === 1) return addDays(day, -2);
  return day;
}

export interface Payment {
  /** `YYYY-MM:1` (dia 15) ou `YYYY-MM:2` (último dia). */
  id: string;
  label: string;
  date: string;
  amountCents: number;
}

/** Quinzenas do mês: X% no dia 15 e o resto no último dia (com os descontos), ajustadas pelo `adjustPayday`. */
export function monthPayments(settings: WorkSettings, monthKey: string): Payment[] {
  const total = computeMonthPay(settings, monthKey).totalCents;
  if (total <= 0) return [];
  const percent = Math.min(100, Math.max(0, settings.firstPaymentPercent));
  const first = Math.round((total * percent) / 100);
  const days = daysOfMonth(monthKey);
  const payments: Payment[] = [];
  if (percent < 100 && first > 0) {
    payments.push({ id: `${monthKey}:1`, label: 'Salário · 1ª quinzena', date: adjustPayday(`${monthKey}-15`), amountCents: first });
  }
  const rest = percent < 100 ? total - first : total;
  payments.push({ id: `${monthKey}:2`, label: percent < 100 ? 'Salário · 2ª quinzena' : 'Salário', date: adjustPayday(days[days.length - 1]!), amountCents: rest });
  return payments;
}

/** Salário que ainda vai cair (de hoje em diante) e não foi marcado como recebido. */
export function upcomingPayments(settings: WorkSettings, monthKey: string, today: string): Payment[] {
  return monthPayments(settings, monthKey).filter((payment) => payment.date >= today && !settings.receivedEarly.includes(payment.id));
}

/** Toque no dia em "Dia a dia": trabalho → atraso → falta → atestado → folga → volta para a escala. */
export function nextDayMark(settings: WorkSettings, day: string): WorkSettings {
  const order: DayMark[] = ['work', 'late', 'absence', 'sick', 'off'];
  const current = settings.overrides[day];
  const overrides = { ...settings.overrides };
  if (current === undefined) {
    overrides[day] = scheduledWork(settings, day) ? 'late' : 'work';
  } else {
    const next = order[order.indexOf(current) + 1];
    if (next === undefined) delete overrides[day];
    else overrides[day] = next;
  }
  return { ...settings, overrides };
}

/** Toque no dia em "Escala": troca trabalho/folga nessa posição do ciclo, para todas as semanas (ou ciclos). */
export function toggleCycleDay(settings: WorkSettings, day: string): WorkSettings {
  const length = settings.cycle.length;
  const position = ((daysBetween(settings.cycleStart, day) % length) + length) % length;
  const cycle = settings.cycle.map((works, index) => (index === position ? !works : works));
  return { ...settings, cycle };
}

/** Novo tamanho de ciclo, começando hoje, com todos os dias de trabalho (o usuário marca as folgas). */
export function resizeCycle(settings: WorkSettings, length: number, today: string): WorkSettings {
  return { ...settings, cycle: Array.from({ length }, () => true), cycleStart: today };
}

/** Lê o que foi salvo; campo ausente ou inválido volta ao padrão. */
export function sanitizeWorkSettings(value: unknown, today: string): WorkSettings | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const raw = value as Record<string, unknown>;
  const base = defaultWorkSettings(today);
  const int = (field: unknown, fallback: number, max: number) =>
    typeof field === 'number' && Number.isInteger(field) && field >= 0 && field <= max ? field : fallback;
  const marks: DayMark[] = ['work', 'off', 'absence', 'late', 'sick'];
  const overrides: Record<string, DayMark> = {};
  if (raw.overrides && typeof raw.overrides === 'object') {
    for (const [day, mark] of Object.entries(raw.overrides as Record<string, unknown>)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && marks.includes(mark as DayMark)) overrides[day] = mark as DayMark;
    }
  }
  const cycle = Array.isArray(raw.cycle) && raw.cycle.length >= 1 && raw.cycle.length <= 28 && raw.cycle.every((item) => typeof item === 'boolean')
    ? (raw.cycle as boolean[])
    : base.cycle;
  return {
    hourlyRateCents: int(raw.hourlyRateCents, 0, 100_000_00),
    shiftMinutes: int(raw.shiftMinutes, base.shiftMinutes, 24 * 60),
    lunchMinutes: int(raw.lunchMinutes, base.lunchMinutes, 24 * 60),
    holidayBonusPercent: int(raw.holidayBonusPercent, base.holidayBonusPercent, 500),
    optionalHolidays: raw.optionalHolidays === true,
    cycleStart: typeof raw.cycleStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.cycleStart) ? raw.cycleStart : base.cycleStart,
    cycle,
    overrides,
    absencePenaltyCents: int(raw.absencePenaltyCents, 0, 100_000_00),
    latePenaltyCents: int(raw.latePenaltyCents, 0, 100_000_00),
    firstPaymentPercent: int(raw.firstPaymentPercent, base.firstPaymentPercent, 100),
    receivedEarly: Array.isArray(raw.receivedEarly) ? raw.receivedEarly.filter((item): item is string => typeof item === 'string' && /^\d{4}-\d{2}:[12]$/.test(item)) : [],
  };
}
