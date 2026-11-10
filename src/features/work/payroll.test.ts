import { describe, expect, it } from 'vitest';
import {
  adjustPayday,
  computeMonthPay,
  defaultWorkSettings,
  easterSunday,
  holidaysOf,
  monthPayments,
  nextDayMark,
  resizeCycle,
  sanitizeWorkSettings,
  scheduledWork,
  toggleCycleDay,
  upcomingPayments,
  type WorkSettings,
} from './payroll';

// R$ 10/h, 9 h no trabalho com 1 h de almoço = 8 h pagas = R$ 80 por dia. Segunda a sábado.
function settings(overrides: Partial<WorkSettings> = {}): WorkSettings {
  return { ...defaultWorkSettings('2026-11-10'), hourlyRateCents: 1000, ...overrides };
}

describe('feriados', () => {
  it('Páscoa e Sexta-feira Santa', () => {
    expect(easterSunday(2026)).toBe('2026-04-05');
    expect(easterSunday(2027)).toBe('2027-03-28');
    expect(holidaysOf(2026, false).get('2026-04-03')).toBe('Sexta-feira Santa');
  });

  it('Carnaval e Corpus Christi só quando o usuário liga', () => {
    expect(holidaysOf(2026, false).has('2026-02-17')).toBe(false);
    expect(holidaysOf(2026, true).get('2026-02-17')).toBe('Carnaval');
    expect(holidaysOf(2026, true).get('2026-06-04')).toBe('Corpus Christi');
  });
});

describe('computeMonthPay', () => {
  it('novembro/2026: 25 dias, feriados de 02/11 e 20/11 trabalhados em dobro', () => {
    const pay = computeMonthPay(settings(), '2026-11');
    expect(pay).toMatchObject({ workedDays: 25, holidaysWorked: 2, baseCents: 200000, holidayExtraCents: 16000, totalCents: 216000 });
    expect(pay.paidMinutes).toBe(25 * 8 * 60);
  });

  it('mês de 31 dias rende mais que o de 30', () => {
    expect(computeMonthPay(settings(), '2026-10').workedDays).toBe(27);
    expect(computeMonthPay(settings(), '2026-10').totalCents).toBeGreaterThan(computeMonthPay(settings(), '2026-11').totalCents);
  });

  it('falta desconta o dia e a multa (ex.: R$ 150); atestado paga o dia', () => {
    const withAbsence = settings({ absencePenaltyCents: 15000, overrides: { '2026-11-03': 'absence', '2026-11-04': 'sick' } });
    expect(computeMonthPay(withAbsence, '2026-11')).toMatchObject({ workedDays: 24, absences: 1, sickDays: 1, penaltiesCents: 15000, totalCents: 193000 });
  });

  it('atraso paga o dia e desconta o valor do atraso', () => {
    const late = settings({ latePenaltyCents: 2000, overrides: { '2026-11-05': 'late' } });
    expect(computeMonthPay(late, '2026-11')).toMatchObject({ workedDays: 25, lates: 1, totalCents: 214000 });
  });

  it('sem valor da hora, nada a receber', () => {
    expect(computeMonthPay(settings({ hourlyRateCents: 0 }), '2026-11').totalCents).toBe(0);
    expect(monthPayments(settings({ hourlyRateCents: 0 }), '2026-11')).toEqual([]);
  });
});

describe('quinzenas', () => {
  it('domingo ou segunda antecipa para o sábado', () => {
    expect(adjustPayday('2026-11-15')).toBe('2026-11-14');
    expect(adjustPayday('2026-11-30')).toBe('2026-11-28');
    expect(adjustPayday('2026-12-15')).toBe('2026-12-15');
  });

  it('40% no dia 15 e o resto no último dia', () => {
    expect(monthPayments(settings(), '2026-11')).toEqual([
      { id: '2026-11:1', label: 'Salário · 1ª quinzena', date: '2026-11-14', amountCents: 86400 },
      { id: '2026-11:2', label: 'Salário · 2ª quinzena', date: '2026-11-28', amountCents: 129600 },
    ]);
  });

  it('100% vira um pagamento só no fim do mês', () => {
    expect(monthPayments(settings({ firstPaymentPercent: 100 }), '2026-11')).toEqual([
      { id: '2026-11:2', label: 'Salário', date: '2026-11-28', amountCents: 216000 },
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

  it('12x36: ciclo de 2 dias alterna trabalho e folga', () => {
    const shift = toggleCycleDay(resizeCycle(settings(), 2, '2026-11-10'), '2026-11-11');
    expect(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13'].map((day) => scheduledWork(shift, day))).toEqual([true, false, true, false]);
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
});
