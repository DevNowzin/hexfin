import { describe, expect, it } from 'vitest';
import {
  addDays,
  adjustPayday,
  buildCycle,
  calendarGrossCents,
  clockToMinutes,
  cyclePattern,
  computeMonthPay,
  defaultWorkSettings,
  easterSunday,
  holidayList,
  holidaysOf,
  minutesToClock,
  monthPayments,
  pointPeriod,
  nextDayMark,
  sanitizeWorkSettings,
  scheduledWork,
  toggleCycleDay,
  upcomingPayments,
  type WorkSettings,
} from './payroll';

// R$ 10/h e jornada de 08:00 = R$ 80 por dia; o mês paga todos os dias do calendário. Escala de segunda a sábado.
// Novembro/2026 tem 30 dias: 30 × R$ 80 = R$ 2.400, mais R$ 160 dos feriados de 02 e 20/11 trabalhados.
function settings(overrides: Partial<WorkSettings> = {}): WorkSettings {
  return { ...defaultWorkSettings('2026-11-10'), hourlyRateCents: 1000, ...overrides };
}

describe('feriados', () => {
  it('Páscoa e Sexta-feira Santa', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(holidaysOf(2026, {}).get('2026-04-03')).toBe('Sexta-feira Santa');
  });

  it('Carnaval e Corpus Christi só quando o usuário liga', () => {
    expect(holidaysOf(2026, {}).has('2026-02-17')).toBe(false);
    expect(holidaysOf(2026, { Carnaval: true }).get('2026-02-17')).toBe('Carnaval');
    expect(holidaysOf(2026, { 'Corpus Christi': true }).get('2026-06-04')).toBe('Corpus Christi');
  });

  it('feriado nacional que a empresa não dá pode ser desligado', () => {
    expect(holidaysOf(2026, { Finados: false }).has('2026-11-02')).toBe(false);
    expect(holidayList(2026, { Finados: false }).find((holiday) => holiday.name === 'Finados')).toMatchObject({ date: '2026-11-02', counts: false });
    // Feriado desligado vira dia comum: novembro fica com 1 feriado trabalhado.
    expect(computeMonthPay(settings({ holidayChoices: { Finados: false } }), '2026-11')).toMatchObject({ holidaysWorked: 1, totalCents: 248000 });
  });
});

describe('salário pelo calendário real', () => {
  it('jornada HH:MM vira minutos sem arredondar (07:20 = 440)', () => {
    expect(clockToMinutes('07:20')).toBe(440);
    expect(clockToMinutes('7:05')).toBe(425);
    expect(minutesToClock(440)).toBe('07:20');
    expect([clockToMinutes('7,33'), clockToMinutes('07:60'), clockToMinutes('00:00'), clockToMinutes('25:00')]).toEqual([null, null, null, null]);
  });

  it('massa de teste: R$ 8,11/h e 07:20 → 28 dias 1.665,25; 30 dias 1.784,20; 31 dias 1.843,67', () => {
    expect(calendarGrossCents(811, 440, 28)).toBe(166525);
    expect(calendarGrossCents(811, 440, 30)).toBe(178420);
    expect(calendarGrossCents(811, 440, 31)).toBe(184367);
  });

  it('o mês usa os próprios dias (fevereiro 28, novembro 30, dezembro 31)', () => {
    const real = settings({ hourlyRateCents: 811, dailyMinutes: 440, holidayChoices: { Natal: false, 'Confraternização Universal': false } });
    expect(computeMonthPay(real, '2027-02')).toMatchObject({ periodDays: 28, baseCents: 166525 });
    expect(computeMonthPay(real, '2026-11')).toMatchObject({ periodDays: 30, baseCents: 178420, paidMinutes: 30 * 440 });
    expect(computeMonthPay(real, '2026-12')).toMatchObject({ periodDays: 31, baseCents: 184367, totalCents: 184367 });
  });
});

describe('computeMonthPay', () => {
  it('novembro/2026: 30 dias de jornada, feriados de 02/11 e 20/11 trabalhados em dobro', () => {
    const pay = computeMonthPay(settings(), '2026-11');
    expect(pay).toMatchObject({ periodDays: 30, workedDays: 25, holidaysWorked: 2, baseCents: 240000, absenceCents: 0, holidayExtraCents: 16000, totalCents: 256000 });
    expect(pay.paidMinutes).toBe(30 * 8 * 60);
  });

  it('mês de 31 dias rende mais que o de 30', () => {
    expect(computeMonthPay(settings(), '2026-10').workedDays).toBe(27);
    // Base pelo calendário: 31 × R$ 80 = R$ 2.480 contra 30 × R$ 80 = R$ 2.400 (o total ainda depende dos feriados de cada mês).
    expect(computeMonthPay(settings(), '2026-10').baseCents).toBe(248000);
    expect(computeMonthPay(settings(), '2026-11').baseCents).toBe(240000);
  });

  it('assiduidade (ex.: R$ 150) entra no mês sem falta nem atraso', () => {
    expect(computeMonthPay(settings({ attendanceBonusCents: 15000 }), '2026-11')).toMatchObject({ attendanceBonusCents: 15000, attendanceLost: false, totalCents: 271000 });
  });

  it('falta: tira 1 jornada cada e perde a assiduidade inteira (uma vez só)', () => {
    const twoAbsences = settings({ attendanceBonusCents: 15000, overrides: { '2026-11-03': 'absence', '2026-11-04': 'absence' } });
    expect(computeMonthPay(twoAbsences, '2026-11')).toMatchObject({ workedDays: 23, absences: 2, absenceCents: 16000, attendanceBonusCents: 0, attendanceLost: true, penaltiesCents: 0, totalCents: 240000 });
  });

  it('atestado paga o dia e não tira a assiduidade', () => {
    const sick = settings({ attendanceBonusCents: 15000, overrides: { '2026-11-04': 'sick' } });
    expect(computeMonthPay(sick, '2026-11')).toMatchObject({ workedDays: 25, sickDays: 1, absenceCents: 0, attendanceBonusCents: 15000, totalCents: 271000 });
  });

  it('atestado tira a assiduidade quando a empresa é assim (o dia continua pago)', () => {
    const strict = settings({ attendanceBonusCents: 15000, sickLosesBonus: true, overrides: { '2026-11-04': 'sick' } });
    expect(computeMonthPay(strict, '2026-11')).toMatchObject({ workedDays: 25, sickDays: 1, attendanceBonusCents: 0, attendanceLost: true, totalCents: 256000 });
    expect(sanitizeWorkSettings({ sickLosesBonus: true }, '2026-11-10')?.sickLosesBonus).toBe(true);
    expect(sanitizeWorkSettings({}, '2026-11-10')?.sickLosesBonus).toBe(false);
  });

  it('atraso paga o dia, desconta o atraso e também tira a assiduidade', () => {
    const late = settings({ attendanceBonusCents: 15000, latePenaltyCents: 2000, overrides: { '2026-11-05': 'late' } });
    expect(computeMonthPay(late, '2026-11')).toMatchObject({ workedDays: 25, lates: 1, attendanceLost: true, penaltiesCents: 2000, totalCents: 254000 });
  });

  it('sem valor da hora, nada a receber', () => {
    expect(computeMonthPay(settings({ hourlyRateCents: 0 }), '2026-11').totalCents).toBe(0);
    expect(monthPayments(settings({ hourlyRateCents: 0 }), '2026-11')).toEqual([]);
  });
});

describe('fechamento do ponto (16 a 15)', () => {
  const company = (overrides: Partial<WorkSettings> = {}) => settings({ cutoffDay: 15, ...overrides });

  it('o período do ponto vai de 16 do mês anterior a 15 deste (inclusive na virada do ano)', () => {
    expect(pointPeriod({ cutoffDay: 15 }, '2026-11')).toEqual({ start: '2026-10-16', end: '2026-11-15' });
    expect(pointPeriod({ cutoffDay: 15 }, '2027-01')).toEqual({ start: '2026-12-16', end: '2027-01-15' });
    expect(pointPeriod({ cutoffDay: 0 }, '2026-11')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
  });

  it('feriado até o dia 15 entra no pagamento do mês; o do dia 20 vai para o mês seguinte', () => {
    // Novembro: 02/11 (Finados) trabalhado; 15/11 cai no domingo de folga; 20/11 fica para dezembro.
    expect(computeMonthPay(company(), '2026-11')).toMatchObject({ holidaysWorked: 1, holidayExtraCents: 8000, baseCents: 240000, totalCents: 248000 });
    expect(computeMonthPay(company(), '2026-12')).toMatchObject({ holidaysWorked: 1, baseCents: 248000, totalCents: 256000 });
  });

  it('falta do dia 18 desconta no mês seguinte; Natal e Ano-Novo entram juntos no pagamento de janeiro', () => {
    const absent = company({ overrides: { '2026-11-18': 'absence' } });
    expect(computeMonthPay(absent, '2026-11')).toMatchObject({ absences: 0, absenceCents: 0 });
    expect(computeMonthPay(absent, '2026-12')).toMatchObject({ absences: 1, absenceCents: 8000 });
    expect(computeMonthPay(company(), '2027-01')).toMatchObject({ holidaysWorked: 2 });
  });

  it('o fechamento salvo é lido (0 a 28) e começa em 0 (fim do mês)', () => {
    expect(sanitizeWorkSettings({ cutoffDay: 15 }, '2026-11-10')?.cutoffDay).toBe(15);
    expect(sanitizeWorkSettings({ cutoffDay: 31 }, '2026-11-10')?.cutoffDay).toBe(0);
    expect(defaultWorkSettings('2026-11-10').cutoffDay).toBe(0);
  });
});

describe('quinzenas', () => {
  it('domingo ou segunda antecipa para o sábado', () => {
    expect(adjustPayday('2026-11-15')).toBe('2026-11-14');
    expect(adjustPayday('2026-11-30')).toBe('2026-11-28');
    expect(adjustPayday('2026-12-15')).toBe('2026-12-15');
  });

  it('dia 15: 40% do salário base; o resto e os feriados acertam no último dia', () => {
    expect(monthPayments(settings(), '2026-11')).toEqual([
      { id: '2026-11:1', label: 'Salário · 1ª quinzena', date: '2026-11-14', amountCents: 96000 },
      { id: '2026-11:2', label: 'Salário · 2ª quinzena', date: '2026-11-28', amountCents: 160000 },
    ]);
  });

  it('100% vira um pagamento só no fim do mês', () => {
    expect(monthPayments(settings({ firstPaymentPercent: 100 }), '2026-11')).toEqual([
      { id: '2026-11:2', label: 'Salário', date: '2026-11-28', amountCents: 256000 },
    ]);
  });

  it('a receber: só o que ainda vai cair e não foi marcado como recebido antes', () => {
    expect(upcomingPayments(settings(), '2026-11', '2026-11-10').map((item) => item.id)).toEqual(['2026-11:1', '2026-11:2']);
    expect(upcomingPayments(settings({ receivedEarly: ['2026-11:1'] }), '2026-11', '2026-11-10').map((item) => item.id)).toEqual(['2026-11:2']);
    expect(upcomingPayments(settings(), '2026-11', '2026-11-20').map((item) => item.id)).toEqual(['2026-11:2']);
  });
});

describe('escala no calendário', () => {
  it('a escala se repete: o domingo de folga vale para todos os domingos do ano', () => {
    const base = settings();
    expect(scheduledWork(base, '2026-11-08')).toBe(false);
    expect(scheduledWork(base, '2027-03-07')).toBe(false);
    expect(scheduledWork(base, '2027-03-08')).toBe(true);
    const saturdayOff = toggleCycleDay(base, '2026-11-14');
    expect(scheduledWork(saturdayOff, '2026-12-19')).toBe(false);
  });

  it('12x36 é 1x1: alterna trabalho e folga', () => {
    const shift = buildCycle(settings(), 1, 1, '2026-11-10');
    expect(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((day) => scheduledWork(shift, day))).toEqual([true, false, true, false]);
  });

  it('6x2: trabalha 6, folga 2 e a folga anda um dia por semana', () => {
    const six = buildCycle(settings(), 6, 2, '2026-11-10');
    const week = (from: string) => Array.from({ length: 8 }, (_, index) => scheduledWork(six, addDays(from, index)));
    expect(week('2026-11-10')).toEqual([true, true, true, true, true, true, false, false]);
    // Folgas: 16 e 17/11 (seg e ter), depois 24 e 25/11 (ter e qua), 02 e 03/12 (qua e qui)...
    expect(['2026-11-16', '2026-11-17', '2026-11-24', '2026-11-25', '2026-12-02', '2026-12-03'].every((day) => !scheduledWork(six, day))).toBe(true);
    expect(scheduledWork(six, '2026-11-23')).toBe(true);
    // Antes do 1º dia tocado a escala vale para trás: 08 e 09/11 foram folga.
    expect([scheduledWork(six, '2026-11-08'), scheduledWork(six, '2026-11-09')]).toEqual([false, false]);
    expect(cyclePattern(six.cycle)).toEqual([6, 2]);
  });

  it('reconhece a escala N x M e a personalizada', () => {
    expect(cyclePattern(settings().cycle)).toBeNull();
    expect(cyclePattern([true, true, true, true, true, false, false])).toEqual([5, 2]);
    expect(cyclePattern([true, true])).toEqual([2, 0]);
  });

  it('toque no dia: trabalho → atraso → falta → atestado → folga → volta para a escala', () => {
    let current = settings();
    const marks: Array<string | undefined> = [];
    for (let index = 0; index < 5; index += 1) {
      current = nextDayMark(current, '2026-11-10');
      marks.push(current.overrides['2026-11-10']);
    }
    expect(marks).toEqual(['late', 'absence', 'sick', 'off', undefined]);
    expect(nextDayMark(settings(), '2026-11-08').overrides['2026-11-08']).toBe('work');
  });

  it('dados salvos inválidos voltam ao padrão', () => {
    const clean = sanitizeWorkSettings({ hourlyRateCents: -5, cycle: ['x'], overrides: { '2026-11-10': 'absence', ruim: 'off', '2026-11-11': 'festa' }, receivedEarly: ['2026-11:1', 'lixo'] }, '2026-11-10');
    expect(clean?.hourlyRateCents).toBe(0);
    expect(clean?.cycle).toHaveLength(7);
    expect(clean?.overrides).toEqual({ '2026-11-10': 'absence' });
    expect(clean?.receivedEarly).toEqual(['2026-11:1']);
    expect(sanitizeWorkSettings(null, '2026-11-10')).toBeUndefined();
  });

  it('dados da versão anterior: desconto por falta vira assiduidade e o liga de Carnaval vira escolha por feriado', () => {
    const old = sanitizeWorkSettings({ absencePenaltyCents: 15000, optionalHolidays: true }, '2026-11-10');
    expect(old?.attendanceBonusCents).toBe(15000);
    expect(old?.holidayChoices).toEqual({ Carnaval: true, 'Corpus Christi': true });
  });

  it('dados da versão anterior: horas no trabalho menos almoço viram a jornada paga', () => {
    expect(sanitizeWorkSettings({ shiftMinutes: 540, lunchMinutes: 60 }, '2026-11-10')?.dailyMinutes).toBe(480);
    expect(sanitizeWorkSettings({ shiftMinutes: 500, lunchMinutes: 60 }, '2026-11-10')?.dailyMinutes).toBe(440);
    expect(sanitizeWorkSettings({ dailyMinutes: 440, shiftMinutes: 540 }, '2026-11-10')?.dailyMinutes).toBe(440);
    expect(sanitizeWorkSettings({}, '2026-11-10')?.dailyMinutes).toBe(480);
  });
});
