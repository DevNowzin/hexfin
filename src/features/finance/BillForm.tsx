import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppTheme } from '@/theme/AppTheme';
import { amountInputToCents, centsToAmountInput, formatAmountInput, toDateInput } from '@/utils/format';
import { firstDueMonth, installmentsFor, nextBillOccurrence, validateBillDraft } from './bills';
import { categoriesForType } from './categories';
import { useFinance } from './FinanceContext';
import type { PlannedBill, PlannedBillDraft, PlannedBillKind } from './types';

const KINDS: Array<{ id: PlannedBillKind; label: string }> = [
  { id: 'fixed', label: 'Conta fixa' },
  { id: 'loan', label: 'Empréstimo' },
];

interface BillFormProps {
  bill?: PlannedBill;
  onDelete?: () => void;
}

/** Cadastro de conta fixa ou empréstimo. Só prevê o vencimento: não cria transação nem mexe no saldo. */
export function BillForm({ bill, onDelete }: BillFormProps) {
  const { accounts, addBill, updateBill } = useFinance();
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const today = toDateInput();
  const [kind, setKind] = useState<PlannedBillKind>(bill?.kind ?? 'fixed');
  const [description, setDescription] = useState(bill?.description ?? '');
  const [amountDigits, setAmountDigits] = useState(centsToAmountInput(bill?.amountCents ?? 0));
  const [dueDayText, setDueDayText] = useState(bill ? String(bill.dueDay) : '');
  const [remainingText, setRemainingText] = useState(() => {
    const remaining = bill ? nextBillOccurrence(bill, today)?.remaining : undefined;
    return remaining ? String(remaining) : '';
  });
  const [categoryId, setCategoryId] = useState(bill?.categoryId ?? 'housing');
  const [accountId, setAccountId] = useState<string | undefined>(bill?.accountId);
  const [error, setError] = useState('');
  const categories = categoriesForType('expense');

  function save() {
    const dueDay = Number(dueDayText);
    const remaining = Number(remainingText);
    const startMonth = bill?.startMonth ?? (Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31 ? firstDueMonth(dueDay, today) : today.slice(0, 7));
    const draft: PlannedBillDraft = {
      description: description.trim(),
      amountCents: amountInputToCents(amountDigits),
      dueDay,
      categoryId,
      kind,
      startMonth,
      ...(accountId ? { accountId } : {}),
      ...(kind === 'loan' ? { installments: remaining > 0 ? installmentsFor(startMonth, dueDay, remaining, today) : 0 } : {}),
    };
    const problem = validateBillDraft(draft);
    if (problem) return setError(problem);
    if (bill) updateBill(bill.id, draft);
    else addBill(draft);
    if (router.canGoBack()) router.back();
    else router.replace('/recurring');
  }

  const inputStyle = [styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, fontFamily: fonts.regular }];
  const labelStyle = [styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }];

  return (
    <Screen>
      <ScreenHeader title={bill ? 'Editar conta prevista' : 'Nova conta prevista'} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[styles.typeSelector, { backgroundColor: colors.surface }]}>
          {KINDS.map((item) => {
            const active = kind === item.id;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setKind(item.id)}
                style={[styles.typeOption, { backgroundColor: active ? colors.text : 'transparent' }]}
              >
                <Text style={[styles.typeText, { color: active ? colors.background : colors.textMuted, fontFamily: fonts.semiBold }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Card style={styles.amountCard}>
          <Text style={labelStyle}>{kind === 'loan' ? 'Valor da parcela' : 'Valor por mês'}</Text>
          <View style={styles.amountRow}>
            <Text style={[styles.currency, { color: colors.textMuted, fontFamily: fonts.medium }]}>R$</Text>
            <TextInput
              accessibilityLabel="Valor"
              value={formatAmountInput(amountDigits)}
              onChangeText={(value) => setAmountDigits(value.replace(/\D/g, '').slice(0, 12))}
              keyboardType="numeric"
              placeholder="0,00"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              style={[styles.amountInput, { color: colors.text, fontFamily: fonts.bold }]}
            />
          </View>
        </Card>

        <View style={styles.field}>
          <Text style={labelStyle}>Nome</Text>
          <TextInput
            accessibilityLabel="Nome da conta"
            value={description}
            onChangeText={setDescription}
            placeholder={kind === 'loan' ? 'Ex.: Empréstimo do carro' : 'Ex.: Aluguel, luz, internet'}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            maxLength={60}
            style={inputStyle}
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={labelStyle}>Dia do vencimento</Text>
            <TextInput
              accessibilityLabel="Dia do vencimento"
              value={dueDayText}
              onChangeText={(value) => setDueDayText(value.replace(/\D/g, '').slice(0, 2))}
              keyboardType="number-pad"
              placeholder="1 a 31"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              style={inputStyle}
            />
          </View>
          {kind === 'loan' ? (
            <View style={styles.fieldHalf}>
              <Text style={labelStyle}>Parcelas que faltam</Text>
              <TextInput
                accessibilityLabel="Parcelas que faltam"
                value={remainingText}
                onChangeText={(value) => setRemainingText(value.replace(/\D/g, '').slice(0, 3))}
                keyboardType="number-pad"
                placeholder="Ex.: 12"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
                style={inputStyle}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={labelStyle}>Categoria</Text>
          <View style={styles.chips}>
            {categories.map((category) => {
              const active = category.id === categoryId;
              return (
                <Pressable
                  key={category.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setCategoryId(category.id)}
                  style={[styles.chip, { backgroundColor: active ? `${category.color}20` : colors.surface, borderColor: active ? category.color : colors.border }]}
                >
                  <View style={[styles.chipDot, { backgroundColor: category.color }]} />
                  <Text style={[styles.chipText, { color: active ? colors.text : colors.textMuted, fontFamily: active ? fonts.semiBold : fonts.regular }]}>{category.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {accounts.length > 0 ? (
          <View style={styles.field}>
            <Text style={labelStyle}>Onde é cobrada</Text>
            <View style={styles.chips}>
              {[{ id: undefined, label: 'Eu pago', color: colors.textMuted }, ...accounts.map((account) => ({ id: account.id, label: account.name, color: account.color }))].map((option) => {
                const active = option.id === accountId;
                return (
                  <Pressable
                    key={option.id ?? 'none'}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setAccountId(option.id)}
                    style={[styles.chip, { backgroundColor: active ? colors.text : colors.surface, borderColor: active ? colors.text : colors.border }]}
                  >
                    <View style={[styles.chipDot, { backgroundColor: option.color }]} />
                    <Text style={[styles.chipText, { color: active ? colors.background : colors.textMuted, fontFamily: active ? fonts.semiBold : fonts.regular }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        <Text style={[styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }]}>
          Aparece em Recorrentes e no total por mês, mas não mexe no saldo nem nos gastos. Quando pagar, lance a transação ou deixe o Open Finance trazer.
        </Text>

        {error ? <Text style={[styles.error, { color: colors.expense, fontFamily: fonts.medium }]}>{error}</Text> : null}
        <Button label={bill ? 'Salvar alterações' : 'Adicionar'} icon="checkmark" onPress={save} />
        {bill && onDelete ? <Button label="Excluir conta prevista" icon="trash-outline" variant="ghost" onPress={onDelete} style={styles.deleteButton} /> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  typeSelector: { flexDirection: 'row', borderRadius: 18, padding: 4, marginBottom: 14 },
  typeOption: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeText: { fontSize: 14 },
  amountCard: { marginBottom: 20 },
  fieldLabel: { fontSize: 12, marginBottom: 9 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  currency: { fontSize: 23 },
  amountInput: { flex: 1, minWidth: 0, fontSize: 34, letterSpacing: -1, paddingVertical: 2, outlineStyle: 'none' } as never,
  field: { marginBottom: 20 },
  fieldRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  fieldHalf: { flex: 1 },
  input: { minHeight: 52, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingVertical: 13, fontSize: 14, outlineStyle: 'none' } as never,
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12 },
  hint: { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  error: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  deleteButton: { marginTop: 8 },
});
