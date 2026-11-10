// Salário por hora: escala, feriados, faltas e quinzenas (funções puras, testadas). Dinheiro em centavos.
// É só previsão: não cria transação nem mexe em saldo; o salário de verdade entra quando cair na conta.

/** Como foi (ou vai ser) um dia: a escala diz trabalho ou folga; o usuário marca as exceções. */
export type DayMark = 'work' | 'off' | 'absence' | 'late' | 'sick';

export interface WorkSettings {
  hourlyRateCents: number;
  /** Jornada paga por dia, em minutos (ex.: 07:20 = 440). Vale para todos os dias do mês, trabalho e folga. */
  dailyMinutes: number;
  /** Adicional por feriado trabalhado (100 = recebe o dobro no dia). */
  holidayBonusPercent: number;
  /** Feriados que valem (ou não) na empresa, pelo nome. Ausente = padrão (nacionais sim; Carnaval e Corpus Christi não). */
  holidayChoices: Record<string, boolean>;
  /** Primeiro dia do ciclo da escala (`YYYY-MM-DD`). */
  cycleStart: string;
  /** Um item por dia do ciclo: `true` = trabalha. Repete para sempre a partir de `cycleStart`. */
  cycle: boolean[];
  /** Dias que fogem da escala (falta, atraso, atestado, folga ou trabalho extra). */
  overrides: Record<string, DayMark>;
  /** Prêmio de assiduidade: entra no mês sem falta e sem atraso; uma falta ou um atraso tira o prêmio inteiro. */
  attendanceBonusCents: number;
  /** Na empresa, atestado também tira a assiduidade (o dia continua pago). */
  sickLosesBonus: boolean;
  /** Desconto por atraso (cada atraso). */
  latePenaltyCents: number;
  /** Dia em que o ponto fecha (ex.: 15 = de 16 do mês anterior a 15 deste). 0 = fecha no fim do mês. */
  cutoffDay: number;
  /** Quanto do salário base cai no dia 15 (o resto e os extras do ponto caem no último dia). 100 = tudo no fim do mês. */
  firstPaymentPercent: number;
  /** Pagamentos (`YYYY-MM:1` ou `YYYY-MM:2`) que o usuário marcou como recebidos antes da data. */
  receivedEarly: string[];
}

export const MAX_CYCLE_PART = 14;

/** Escala inicial: segunda a sábado, folga no domingo (ciclo de 7 dias começando num domingo). */
export function defaultWorkSettings(today: string): WorkSettings {
  const date = parseDay(today);
  const sunday = addDays(today, -date.getDay());
  return {
    hourlyRateCents: 0,
    dailyMinutes: 8 * 60,
    holidayBonusPercent: 100,
    holidayChoices: {},
    cycleStart: sunday,
    cycle: [false, true, true, true, true, true, true],
    overrides: {},
    attendanceBonusCents: 0,
    sickLosesBonus: false,
    latePenaltyCents: 0,
    cutoffDay: 0,
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

/** Ponto facultativo: só vale se o usuário ligar. */
export const OPTIONAL_HOLIDAYS = ['Carnaval', 'Corpus Christi'];

export interface Holiday {
  date: string;
  name: string;
  /** Vale na empresa (pela escolha do usuário ou pelo padrão). */
  counts: boolean;
}

/** Todos os feriados nacionais do ano (e os facultativos), com a escolha do usuário aplicada. */
export function holidayList(year: number, choices: Record<string, boolean>): Holiday[] {
  const easter = easterSunday(year);
  const all: Array<[string, string]> = [
    ...FIXED_HOLIDAYS.map(([day, name]): [string, string] => [`${year}-${day}`, name]),
    [addDays(easter, -48), 'Carnaval'],
    [addDays(easter, -47), 'Carnaval'],
    [addDays(easter, -2), 'Sexta-feira Santa'],
    [addDays(easter, 60), 'Corpus Christi'],
  ];
  return all
    .map(([date, name]) => ({ date, name, counts: choices[name] ?? !OPTIONAL_HOLIDAYS.includes(name) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Feriados que valem na empresa no ano (data → nome). */
export function holidaysOf(year: number, choices: Record<string, boolean>): Map<string, string> {
  return new Map(holidayList(year, choices).filter((holiday) => holiday.counts).map((holiday) => [holiday.date, holiday.name]));
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

/** "07:20" → 440 minutos; formato inválido, zero ou mais de 24 h → null. */
export function clockToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

/** 440 → "07:20". */
export function minutesToClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Bruto do horista pelo calendário real: dias do período × jornada × valor da hora (dias trabalhados + folgas/DSR,
 * sem o divisor fixo de 220 h). Tudo em inteiros, arredondando só no fim: 7h20 é 440 min, nunca 7,3333.
 * Ex.: R$ 8,11 e 07:20 → 28 dias = R$ 1.665,25; 30 = R$ 1.784,20; 31 = R$ 1.843,67.
 */
export function calendarGrossCents(hourlyRateCents: number, dailyMinutes: number, periodDays: number): number {
  return Math.round((hourlyRateCents * dailyMinutes * Math.max(0, periodDays)) / 60);
}

export const MAX_CUTOFF_DAY = 28;

/** Período do ponto que entra no pagamento do mês: de (fechamento + 1) do mês anterior até o fechamento; sem fechamento, o mês todo. */
export function pointPeriod(settings: Pick<WorkSettings, 'cutoffDay'>, monthKey: string): { start: string; end: string } {
  const days = daysOfMonth(monthKey);
  const cutoff = settings.cutoffDay;
  if (!Number.isInteger(cutoff) || cutoff < 1 || cutoff > MAX_CUTOFF_DAY) return { start: days[0]!, end: days[days.length - 1]! };
  const end = `${monthKey}-${String(cutoff).padStart(2, '0')}`;
  return { start: addDays(`${previousMonthKey(monthKey)}-${String(cutoff).padStart(2, '0')}`, 1), end };
}

/** Mês anterior (`YYYY-MM`). */
function previousMonthKey(monthKey: string): string {
  return addDays(`${monthKey}-01`, -1).slice(0, 7);
}

function dayRange(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end; day = addDays(day, 1)) days.push(day);
  return days;
}

export interface MonthPay {
  /** Dias do mês (28 a 31): base do salário. */
  periodDays: number;
  workedDays: number;
  /** Horas do período (dias do mês × jornada), em minutos. */
  paidMinutes: number;
  holidaysWorked: number;
  absences: number;
  lates: number;
  sickDays: number;
  /** Dias do mês × jornada × valor da hora. */
  baseCents: number;
  /** Cada falta tira 1 jornada. */
  absenceCents: number;
  holidayExtraCents: number;
  /** Prêmio de assiduidade que entra no mês (zero se houve falta ou atraso). */
  attendanceBonusCents: number;
  /** Perdeu o prêmio de assiduidade neste mês. */
  attendanceLost: boolean;
  /** Descontos de atraso. */
  penaltiesCents: number;
  totalCents: number;
}

/**
 * Previsão do mês pelo calendário: todos os dias do mês (trabalho e folga) pagam a jornada. O que vem do ponto
 * (feriado trabalhado, falta, atraso, atestado e assiduidade) segue o período do ponto: com fechamento no dia 15,
 * o que acontece de 16/10 a 15/11 entra no pagamento de novembro. Cada falta tira 1 jornada; feriado trabalhado
 * ganha o adicional; atestado paga o dia e só tira o prêmio se a empresa for assim.
 */
export function computeMonthPay(settings: WorkSettings, monthKey: string): MonthPay {
  const days = daysOfMonth(monthKey);
  const period = pointPeriod(settings, monthKey);
  const pointDays = dayRange(period.start, period.end);
  const holidays = new Map([
    ...holidaysOf(Number(period.start.slice(0, 4)), settings.holidayChoices),
    ...holidaysOf(Number(period.end.slice(0, 4)), settings.holidayChoices),
  ]);
  const dayCents = Math.round((settings.hourlyRateCents * settings.dailyMinutes) / 60);
  const pay: MonthPay = {
    periodDays: days.length, workedDays: 0, paidMinutes: days.length * settings.dailyMinutes, holidaysWorked: 0, absences: 0, lates: 0, sickDays: 0,
    baseCents: calendarGrossCents(settings.hourlyRateCents, settings.dailyMinutes, days.length),
    absenceCents: 0, holidayExtraCents: 0, attendanceBonusCents: 0, attendanceLost: false, penaltiesCents: 0, totalCents: 0,
  };
  for (const day of pointDays) {
    const mark = dayMark(settings, day);
    if (mark === 'off') continue;
    if (mark === 'absence') {
      pay.absences += 1;
      continue;
    }
    pay.workedDays += 1;
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
  // Desconto exato das faltas (mesma conta do bruto, sem somar arredondamentos de cada dia).
  pay.absenceCents = pay.baseCents - calendarGrossCents(settings.hourlyRateCents, settings.dailyMinutes, days.length - Math.min(pay.absences, days.length));
  const lost = pay.absences > 0 || pay.lates > 0 || (settings.sickLosesBonus && pay.sickDays > 0);
  pay.attendanceLost = settings.attendanceBonusCents > 0 && lost;
  pay.attendanceBonusCents = lost ? 0 : settings.attendanceBonusCents;
  pay.totalCents = Math.max(0, pay.baseCents - pay.absenceCents + pay.holidayExtraCents + pay.attendanceBonusCents - pay.penaltiesCents);
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
  const pay = computeMonthPay(settings, monthKey);
  const total = pay.totalCents;
  if (total <= 0) return [];
  const percent = Math.min(100, Math.max(0, settings.firstPaymentPercent));
  // Dia 15: parte do salário base. Feriados, faltas, atrasos e assiduidade acertam no último dia.
  const first = Math.min(total, Math.round((pay.baseCents * percent) / 100));
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

/**
 * Escala "trabalho N, folgo M" (ex.: 6x2 = ciclo de 8 dias, a folga anda um dia por semana; 12x36 = 1x1)
 * começando no 1º dia de trabalho que o usuário tocou no calendário.
 */
export function buildCycle(settings: WorkSettings, workDays: number, offDays: number, firstWorkDay: string): WorkSettings {
  const work = Math.min(MAX_CYCLE_PART, Math.max(1, Math.round(workDays)));
  const off = Math.min(MAX_CYCLE_PART, Math.max(0, Math.round(offDays)));
  return { ...settings, cycle: [...Array.from({ length: work }, () => true), ...Array.from({ length: off }, () => false)], cycleStart: firstWorkDay };
}

/** A escala é "N dias de trabalho seguidos de M de folga"? Devolve [N, M]; senão (personalizada), null. */
export function cyclePattern(cycle: boolean[]): [number, number] | null {
  const work = cycle.indexOf(false) === -1 ? cycle.length : cycle.indexOf(false);
  const rest = cycle.slice(work);
  return work > 0 && rest.every((works) => !works) ? [work, rest.length] : null;
}

function sanitizeChoices(raw: Record<string, unknown>): Record<string, boolean> {
  const choices: Record<string, boolean> = {};
  if (raw.holidayChoices && typeof raw.holidayChoices === 'object') {
    for (const [name, value] of Object.entries(raw.holidayChoices as Record<string, unknown>)) {
      if (typeof value === 'boolean' && name.length <= 60) choices[name] = value;
    }
  }
  // Versão anterior: um liga/desliga só para Carnaval e Corpus Christi.
  if (raw.optionalHolidays === true) for (const name of OPTIONAL_HOLIDAYS) choices[name] ??= true;
  return choices;
}

/** Jornada paga salva; a versão anterior guardava "horas no trabalho" e "almoço" (jornada = diferença). */
function dailyMinutesOf(raw: Record<string, unknown>, fallback: number): number {
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 24 * 60;
  if (valid(raw.dailyMinutes)) return raw.dailyMinutes;
  const shift = typeof raw.shiftMinutes === 'number' ? raw.shiftMinutes : NaN;
  const lunch = typeof raw.lunchMinutes === 'number' ? raw.lunchMinutes : 0;
  const old = shift - lunch;
  return valid(old) ? old : fallback;
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
    dailyMinutes: dailyMinutesOf(raw, base.dailyMinutes),
    holidayBonusPercent: int(raw.holidayBonusPercent, base.holidayBonusPercent, 500),
    holidayChoices: sanitizeChoices(raw),
    cycleStart: typeof raw.cycleStart === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.cycleStart) ? raw.cycleStart : base.cycleStart,
    cycle,
    overrides,
    // Versão anterior guardava o "desconto por falta"; era o prêmio de assiduidade que se perde.
    attendanceBonusCents: int(raw.attendanceBonusCents ?? raw.absencePenaltyCents, 0, 100_000_00),
    sickLosesBonus: raw.sickLosesBonus === true,
    latePenaltyCents: int(raw.latePenaltyCents, 0, 100_000_00),
    cutoffDay: int(raw.cutoffDay, 0, MAX_CUTOFF_DAY),
    firstPaymentPercent: int(raw.firstPaymentPercent, base.firstPaymentPercent, 100),
    receivedEarly: Array.isArray(raw.receivedEarly) ? raw.receivedEarly.filter((item): item is string => typeof item === 'string' && /^\d{4}-\d{2}:[12]$/.test(item)) : [],
  };
}
