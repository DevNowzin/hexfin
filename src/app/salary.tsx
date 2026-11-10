import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { MonthSelector } from '@/components/MonthSelector';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useFinance } from '@/features/finance/FinanceContext';
import { getCurrentMonthKey } from '@/features/finance/selectors';
import {
  buildCycle,
  computeMonthPay,
  dayMark,
  daysOfMonth,
  defaultWorkSettings,
  holidayList,
  holidaysOf,
  monthPayments,
  nextDayMark,
  cyclePattern,
  MAX_CYCLE_PART,
  toggleCycleDay,
  clockToMinutes,
  minutesToClock,
  type DayMark,
  type WorkSettings,
} from '@/features/work/payroll';
import { useAppTheme } from '@/theme/AppTheme';
import { amountInputToCents, centsToAmountInput, formatAmountInput, formatMonth, parseLocalDate, toDateInput } from '@/utils/format';

type Mode = 'cycle' | 'days';
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MARK_LABELS: Record<DayMark, string> = { work: 'Trabalho', off: 'Folga', late: 'Atraso', absence: 'Falta', sick: 'Atestado' };

function shortDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function minutesToHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace('.', ',').replace(/0$/, '');
}

export default function SalaryScreen() {
  const { work, saveWork } = useFinance();
  const { colors, fonts } = useAppTheme();
  const today = toDateInput();
  const settings: WorkSettings = work ?? defaultWorkSettings(today);
  const [monthKey, setMonthKey] = useState(getCurrentMonthKey());
  const [mode, setMode] = useState<Mode>('cycle');
  const [dailyText, setDailyText] = useState(minutesToClock(settings.dailyMinutes));
  const pattern = cyclePattern(settings.cycle);
  const [workDaysText, setWorkDaysText] = useState(String(pattern?.[0] ?? 6));
  const [offDaysText, setOffDaysText] = useState(String(pattern?.[1] ?? 1));
  // Depois de "Aplicar", o próximo toque no calendário marca o 1º dia de trabalho do ciclo.
  const [pickingStart, setPickingStart] = useState(false);

  const save = (patch: Partial<WorkSettings>) => saveWork({ ...settings, ...patch });
  const pay = computeMonthPay(settings, monthKey);
  const payments = monthPayments(settings, monthKey);
  const holidays = holidaysOf(Number(monthKey.slice(0, 4)), settings.holidayChoices);
  // Carnaval tem dois dias: uma linha por nome.
  const holidayRows = holidayList(Number(monthKey.slice(0, 4)), settings.holidayChoices).reduce<Array<{ name: string; dates: string[]; counts: boolean }>>((rows, holiday) => {
    const row = rows.find((item) => item.name === holiday.name);
    if (row) row.dates.push(holiday.date);
    else rows.push({ name: holiday.name, dates: [holiday.date], counts: holiday.counts });
    return rows;
  }, []);
  const days = daysOfMonth(monthKey);
  const leading = parseLocalDate(days[0]!).getDay();
  const monthName = formatMonth(monthKey, false).toLocaleLowerCase('pt-BR');

  const markColor: Record<DayMark, string> = {
    work: colors.primary, off: colors.surfaceElevated, late: colors.warning, absence: colors.expense, sick: colors.income,
  };
  const labelStyle = [styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }];
  const inputStyle = [styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text, fontFamily: fonts.regular }];

  function toggleReceived(id: string) {
    const received = settings.receivedEarly.includes(id);
    save({ receivedEarly: received ? settings.receivedEarly.filter((item) => item !== id) : [...settings.receivedEarly, id] });
  }

  function tapDay(day: string) {
    if (pickingStart) {
      saveWork(buildCycle(settings, Number(workDaysText || '1'), Number(offDaysText || '0'), day));
      setPickingStart(false);
      return;
    }
    saveWork(mode === 'cycle' ? toggleCycleDay(settings, day) : nextDayMark(settings, day));
  }

  function daysField(label: string, value: string, onChange: (text: string) => void) {
    return (
      <View style={styles.fieldHalf}>
        <Text style={labelStyle}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(text) => onChange(text.replace(/D/g, '').slice(0, 2))}
          keyboardType="number-pad"
          selectionColor={colors.primary}
          style={inputStyle}
        />
      </View>
    );
  }

  function moneyField(label: string, cents: number, onChange: (cents: number) => void) {
    return (
      <View style={styles.fieldHalf}>
        <Text style={labelStyle}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          value={formatAmountInput(centsToAmountInput(cents))}
          onChangeText={(value) => onChange(amountInputToCents(value.replace(/\D/g, '').slice(0, 9)))}
          keyboardType="numeric"
          selectionColor={colors.primary}
          style={inputStyle}
        />
      </View>
    );
  }

  function percentField(label: string, value: number, max: number, onChange: (value: number) => void) {
    return (
      <View style={styles.fieldHalf}>
        <Text style={labelStyle}>{label}</Text>
        <TextInput
          accessibilityLabel={label}
          value={String(value)}
          onChangeText={(text) => onChange(Math.min(max, Number(text.replace(/\D/g, '').slice(0, 3) || '0')))}
          keyboardType="number-pad"
          selectionColor={colors.primary}
          style={inputStyle}
        />
      </View>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Salário por hora" subtitle="Previsão pela sua escala" showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <MonthSelector monthKey={monthKey} onChange={setMonthKey} allowFuture />

        <Card style={styles.summary}>
          <Text style={labelStyle}>Previsto para {monthName}</Text>
          <AmountText cents={pay.totalCents} color={colors.income} style={styles.total} />
          <Text style={[styles.meta, { color: colors.textMuted, fontFamily: fonts.regular }]}>
            {pay.periodDays} dias × {minutesToClock(settings.dailyMinutes)} = {minutesToHours(pay.paidMinutes)} h · {pay.workedDays} de trabalho
            {pay.holidaysWorked > 0 ? ` · ${pay.holidaysWorked} ${pay.holidaysWorked === 1 ? 'feriado' : 'feriados'} (+R$ ${formatAmountInput(String(pay.holidayExtraCents))})` : ''}
          </Text>
          {pay.attendanceBonusCents > 0 ? (
            <Text style={[styles.meta, { color: colors.income, fontFamily: fonts.regular }]}>
              + R$ {formatAmountInput(String(pay.attendanceBonusCents))} de assiduidade
            </Text>
          ) : null}
          {pay.absences > 0 || pay.lates > 0 || (pay.attendanceLost && pay.sickDays > 0) ? (
            <Text style={[styles.meta, { color: colors.expense, fontFamily: fonts.regular }]}>
              {[
                pay.absences > 0 ? `${pay.absences} ${pay.absences === 1 ? 'falta' : 'faltas'} (− R$ ${formatAmountInput(String(pay.absenceCents))})` : null,
                pay.lates > 0 ? `${pay.lates} ${pay.lates === 1 ? 'atraso' : 'atrasos'}${pay.penaltiesCents > 0 ? ` (− R$ ${formatAmountInput(String(pay.penaltiesCents))})` : ''}` : null,
                pay.attendanceLost ? 'perdeu a assiduidade' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          {pay.sickDays > 0 ? (
            <Text style={[styles.meta, { color: colors.textMuted, fontFamily: fonts.regular }]}>
              {pay.sickDays} {pay.sickDays === 1 ? 'atestado' : 'atestados'}: dia pago{settings.sickLosesBonus ? '' : ', sem desconto'}
            </Text>
          ) : null}
          {payments.map((payment) => {
            const received = settings.receivedEarly.includes(payment.id);
            const past = payment.date < today;
            return (
              <View key={payment.id} style={[styles.payment, { borderTopColor: colors.border }]}>
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentLabel, { color: colors.text, fontFamily: fonts.medium }]}>{payment.label}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                    {received ? 'Recebido' : past ? `Caiu em ${shortDate(payment.date)}` : `Previsto para ${shortDate(payment.date)}`}
                  </Text>
                </View>
                <AmountText cents={payment.amountCents} style={styles.paymentAmount} />
                {past && !received ? null : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={received ? `Desfazer: ${payment.label} recebido` : `Marcar ${payment.label} como recebido`}
                    onPress={() => toggleReceived(payment.id)}
                    style={({ pressed }) => [styles.receive, { borderColor: received ? colors.border : colors.primary, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Text style={[styles.receiveText, { color: received ? colors.textMuted : colors.primary, fontFamily: fonts.semiBold }]}>{received ? 'Desfazer' : 'Recebi'}</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          <Text style={[styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }]}>
            É só previsão: aparece em "A receber" no Início e só entra no saldo quando o salário cair na conta.
          </Text>
        </Card>

        <SectionHeader title="Calendário" />
        <View style={[styles.modeSelector, { backgroundColor: colors.surface }]}>
          {(['cycle', 'days'] as Mode[]).map((item) => {
            const active = item === mode;
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setMode(item)}
                style={[styles.modeOption, { backgroundColor: active ? colors.text : 'transparent' }]}
              >
                <Text style={[styles.modeText, { color: active ? colors.background : colors.textMuted, fontFamily: fonts.semiBold }]}>
                  {item === 'cycle' ? 'Escala' : 'Dia a dia'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }]}>
          {mode === 'cycle'
            ? `Escala ${pattern ? `${pattern[0]}x${pattern[1]}` : 'personalizada'} (ciclo de ${settings.cycle.length} dias), repetida pelo resto do ano. Ex.: 6x2 = trabalha 6, folga 2, e a folga anda um dia por semana. Toque num dia para trocar só aquela posição do ciclo.`
            : 'Toque num dia para marcar atraso, falta, atestado ou folga só naquele dia. Mais um toque volta para a escala.'}
        </Text>
        {mode === 'cycle' ? (
          <>
            <View style={styles.fieldRow}>
              {daysField('Trabalho (dias seguidos)', workDaysText, setWorkDaysText)}
              {daysField('Folgo (dias seguidos)', offDaysText, setOffDaysText)}
            </View>
            <Button
              label={pickingStart ? 'Toque no seu 1º dia de trabalho' : `Aplicar escala ${workDaysText || 1}x${offDaysText || 0}`}
              icon={pickingStart ? 'hand-left-outline' : 'calendar-outline'}
              variant={pickingStart ? 'primary' : 'secondary'}
              onPress={() => setPickingStart(!pickingStart)}
              disabled={Number(workDaysText || '0') < 1 || Number(workDaysText) > MAX_CYCLE_PART || Number(offDaysText || '0') > MAX_CYCLE_PART}
            />
          </>
        ) : null}

        <Card style={styles.calendar}>
          <View style={styles.week}>
            {WEEKDAYS.map((label, index) => (
              <Text key={index} style={[styles.weekday, { color: colors.textMuted, fontFamily: fonts.medium }]}>{label}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {Array.from({ length: leading }, (_, index) => <View key={`pad-${index}`} style={styles.cell} />)}
            {days.map((day) => {
              const mark = dayMark(settings, day);
              const marked = settings.overrides[day] !== undefined;
              const holiday = holidays.get(day);
              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityLabel={`${shortDate(day)}: ${MARK_LABELS[mark]}${holiday ? `, feriado (${holiday})` : ''}`}
                  onPress={() => tapDay(day)}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.day,
                      { backgroundColor: mark === 'off' ? 'transparent' : `${markColor[mark]}${mark === 'work' && !marked ? '33' : 'CC'}`, borderColor: day === today ? colors.text : 'transparent' },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: mark === 'off' ? colors.textMuted : colors.text, fontFamily: fonts.medium }]}>{Number(day.slice(8))}</Text>
                    {holiday ? <View style={[styles.holidayDot, { backgroundColor: colors.warning }]} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.legend}>
            {(['work', 'late', 'absence', 'sick'] as DayMark[]).map((mark) => (
              <View key={mark} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: markColor[mark] }]} />
                <Text style={[styles.legendText, { color: colors.textMuted, fontFamily: fonts.regular }]}>{MARK_LABELS[mark]}</Text>
              </View>
            ))}
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.warning, width: 5, height: 5 }]} />
              <Text style={[styles.legendText, { color: colors.textMuted, fontFamily: fonts.regular }]}>Feriado</Text>
            </View>
          </View>
        </Card>
        <Button
          label="Redefinir escala e marcações"
          icon="refresh-outline"
          variant="secondary"
          onPress={() => {
            const fresh = defaultWorkSettings(today);
            saveWork({ ...settings, cycle: fresh.cycle, cycleStart: fresh.cycleStart, overrides: {} });
          }}
        />

        <SectionHeader title="Valores" />
        <View style={styles.fieldRow}>
          {moneyField('Valor da hora (R$)', settings.hourlyRateCents, (cents) => save({ hourlyRateCents: cents }))}
          {percentField('% que cai no dia 15', settings.firstPaymentPercent, 100, (value) => save({ firstPaymentPercent: value }))}
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={labelStyle}>Jornada paga por dia</Text>
            <TextInput
              accessibilityLabel="Jornada paga por dia em horas e minutos"
              value={dailyText}
              onChangeText={(text) => {
                const digits = text.replace(/\D/g, '').slice(0, 4);
                const masked = digits.length > 2 ? `${digits.slice(0, digits.length - 2)}:${digits.slice(-2)}` : digits;
                setDailyText(masked);
                const minutes = clockToMinutes(masked);
                if (minutes !== null) save({ dailyMinutes: minutes });
              }}
              keyboardType="number-pad"
              placeholder="Ex.: 07:20"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              style={inputStyle}
            />
          </View>
          <View style={styles.fieldHalf} />
        </View>
        <View style={styles.fieldRow}>
          {moneyField('Prêmio de assiduidade (R$)', settings.attendanceBonusCents, (cents) => save({ attendanceBonusCents: cents }))}
          {moneyField('Desconto por atraso (R$)', settings.latePenaltyCents, (cents) => save({ latePenaltyCents: cents }))}
        </View>
        <Text style={[styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }]}>
          A assiduidade entra no mês sem falta e sem atraso; uma falta ou um atraso tira o prêmio inteiro. Falta não paga o dia. Atestado sempre paga o dia.
        </Text>
        <Card style={styles.holidayList}>
          <View style={styles.holidayRow}>
            <View style={styles.holidayInfo}>
              <Text style={[styles.holidayName, { color: colors.text, fontFamily: fonts.medium }]}>Atestado tira a assiduidade</Text>
              <Text style={[styles.meta, { color: colors.textMuted, fontFamily: fonts.regular }]}>Ligue se na sua empresa o atestado também faz perder o prêmio.</Text>
            </View>
            <Switch
              accessibilityLabel="Atestado tira a assiduidade"
              value={settings.sickLosesBonus}
              onValueChange={(value) => save({ sickLosesBonus: value })}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>
        <View style={styles.fieldRow}>
          {percentField('Adicional no feriado (%)', settings.holidayBonusPercent, 500, (value) => save({ holidayBonusPercent: value }))}
          <View style={styles.fieldHalf} />
        </View>
        <Text style={[styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }]}>
          O salário conta todos os dias do mês (trabalho e folga): dias do mês × jornada × valor da hora. Cada falta tira 1 jornada. Pagamento no dia 15 e no último dia do mês; domingo ou segunda antecipa para o sábado.
        </Text>

        <SectionHeader title={`Feriados de ${monthKey.slice(0, 4)} na sua empresa`} />
        <Card style={styles.holidayList}>
          {holidayRows.map((holiday, index) => (
            <View key={holiday.name} style={[styles.holidayRow, index > 0 ? { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth } : null]}>
              <View style={styles.holidayInfo}>
                <Text style={[styles.holidayName, { color: colors.text, fontFamily: fonts.medium }]}>{holiday.name}</Text>
                <Text style={[styles.meta, { color: colors.textMuted, fontFamily: fonts.regular }]}>{holiday.dates.map(shortDate).join(' e ')}</Text>
              </View>
              <Switch
                accessibilityLabel={`${holiday.name} vale como feriado na empresa`}
                value={holiday.counts}
                onValueChange={(value) => save({ holidayChoices: { ...settings.holidayChoices, [holiday.name]: value } })}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>
          ))}
        </Card>
        <Text style={[styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }]}>
          Desligado, o dia vira dia comum da escala (sem adicional). Carnaval e Corpus Christi são ponto facultativo e começam desligados.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42, gap: 12 },
  summary: { gap: 6 },
  total: { fontSize: 32, letterSpacing: -1 },
  meta: { fontSize: 12, lineHeight: 18 },
  payment: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  paymentInfo: { flex: 1 },
  paymentLabel: { fontSize: 13 },
  paymentAmount: { fontSize: 13 },
  receive: { minHeight: 44, paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  receiveText: { fontSize: 12 },
  hint: { fontSize: 12, lineHeight: 18 },
  modeSelector: { flexDirection: 'row', borderRadius: 18, padding: 4 },
  modeOption: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modeText: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  chipText: { fontSize: 12 },
  calendar: { gap: 8 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 3 },
  day: { flex: 1, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 13 },
  holidayDot: { position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 11 },
  fieldLabel: { fontSize: 12, marginBottom: 8 },
  fieldRow: { flexDirection: 'row', gap: 12 },
  fieldHalf: { flex: 1 },
  input: { minHeight: 52, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingVertical: 13, fontSize: 14, outlineStyle: 'none' } as never,
  holidayList: { paddingVertical: 4 },
  holidayRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  holidayInfo: { flex: 1 },
  holidayName: { fontSize: 13 },
});
