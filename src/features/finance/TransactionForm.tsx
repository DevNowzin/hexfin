import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CategorySuggestionCard } from '@/features/ai/components/CategorySuggestionCard';
import { useCategorization } from '@/features/ai/useCategorization';
import { categoriesForType } from './categories';
import { useFinance } from './FinanceContext';
import type { Recurrence, Transaction, TransactionStatus, TransactionType } from './types';
import { useAppTheme } from '@/theme/AppTheme';
import {
  amountInputToCents,
  centsToAmountInput,
  formatAmountInput,
  formatLongDate,
  isValidDateInput,
  toDateInput,
} from '@/utils/format';

interface TransactionFormProps {
  transaction?: Transaction;
  defaultType?: TransactionType;
}

const recurrenceOptions: Array<{ id?: Recurrence; label: string }> = [
  { label: 'Não repetir' },
  { id: 'weekly', label: 'Semanal' },
  { id: 'monthly', label: 'Mensal' },
  { id: 'yearly', label: 'Anual' },
];

export function TransactionForm({ transaction, defaultType = 'expense' }: TransactionFormProps) {
  const { accounts, addTransaction, updateTransaction } = useFinance();
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaultType);
  const [amountDigits, setAmountDigits] = useState(centsToAmountInput(transaction?.amountCents ?? 0));
  const [description, setDescription] = useState(transaction?.description ?? '');
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? (defaultType === 'income' ? 'salary' : 'food'));
  const [accountId, setAccountId] = useState(transaction?.accountId ?? accounts[0]?.id ?? '');
  const [date, setDate] = useState(transaction?.date ?? toDateInput());
  const [status, setStatus] = useState<TransactionStatus>(transaction?.status ?? 'completed');
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(transaction?.recurrence);
  const [notes, setNotes] = useState(transaction?.notes ?? '');
  const [error, setError] = useState('');
  // Só sugere depois que o usuário mexe na descrição (não ao abrir uma edição).
  const [descriptionTouched, setDescriptionTouched] = useState(false);
  const categorization = useCategorization(description, type, descriptionTouched);
  const categories = useMemo(() => categoriesForType(type), [type]);
  // Veio do Open Finance: valor, data, tipo, conta, descrição e situação são do banco e não mudam aqui.
  const imported = Boolean(transaction?.externalId);

  function changeType(nextType: TransactionType) {
    setType(nextType);
    const validCategories = categoriesForType(nextType);
    if (!validCategories.some((category) => category.id === categoryId)) {
      setCategoryId(nextType === 'income' ? 'salary' : 'food');
    }
  }

  function save() {
    if (transaction && imported) {
      const { id: _id, createdAt: _createdAt, ...bank } = transaction;
      updateTransaction(transaction.id, { ...bank, categoryId, recurrence, notes: notes.trim() || undefined });
      router.back();
      return;
    }
    const amountCents = amountInputToCents(amountDigits);
    if (!description.trim()) return setError('Informe uma descrição para a transação.');
    if (amountCents <= 0) return setError('Informe um valor maior que zero.');
    if (!accountId) return setError('Selecione uma conta.');
    if (!isValidDateInput(date)) return setError('Use uma data válida no formato AAAA-MM-DD.');

    const draft = {
      description: description.trim(),
      amountCents,
      type,
      date,
      categoryId,
      accountId,
      transferAccountId: transaction?.transferAccountId,
      status,
      recurrence,
      notes: notes.trim() || undefined,
    };
    if (transaction) updateTransaction(transaction.id, draft);
    else addTransaction(draft);
    router.back();
  }

  return (
    <Screen>
      <ScreenHeader title={transaction ? 'Editar transação' : 'Nova transação'} showBack />
      {accounts.length === 0 ? (
        <EmptyState
          icon="wallet-outline"
          title="Primeiro, crie uma conta"
          description="Uma conta é necessária para registrar e organizar suas transações."
          actionLabel="Criar conta"
          onAction={() => router.replace('/accounts/new')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {transaction && imported ? (
            <Card style={styles.amountCard}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>Do banco (Open Finance)</Text>
              <Text style={[styles.lockedTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{transaction.description}</Text>
              <AmountText
                cents={transaction.type === 'income' ? transaction.amountCents : -transaction.amountCents}
                showSign
                color={transaction.type === 'income' ? colors.income : colors.text}
                style={styles.lockedAmount}
              />
              <Text style={[styles.lockedMeta, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                {formatLongDate(transaction.date)} · {accounts.find((item) => item.id === transaction.accountId)?.name ?? 'Conta removida'} · {transaction.status === 'completed' ? 'Concluída' : 'Pendente'}
              </Text>
              <Text style={[styles.lockedMeta, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                Valor, data, tipo e conta vêm do banco. Aqui você muda a categoria, a recorrência e as observações.
              </Text>
            </Card>
          ) : (
          <>
          <View style={[styles.typeSelector, { backgroundColor: colors.surface }]}>
            {(['expense', 'income'] as TransactionType[]).map((item) => {
              const active = type === item;
              return (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => changeType(item)}
                  style={[styles.typeOption, { backgroundColor: active ? colors.text : 'transparent' }]}
                >
                  <Text style={[styles.typeText, { color: active ? colors.background : colors.textMuted, fontFamily: fonts.semiBold }]}>
                    {item === 'expense' ? 'Despesa' : 'Receita'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Card style={styles.amountCard}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>Valor</Text>
            <View style={styles.amountRow}>
              <Text style={[styles.currency, { color: colors.textMuted, fontFamily: fonts.medium }]}>R$</Text>
              <TextInput
                accessibilityLabel="Valor da transação"
                value={formatAmountInput(amountDigits)}
                onChangeText={(value) => setAmountDigits(value.replace(/\D/g, '').slice(0, 12))}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
                autoFocus={!transaction}
                style={[styles.amountInput, { color: colors.text, fontFamily: fonts.bold }]}
              />
            </View>
          </Card>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>Descrição</Text>
            <TextInput
              accessibilityLabel="Descrição da transação"
              value={description}
              onChangeText={(value) => {
                setDescription(value);
                setDescriptionTouched(true);
              }}
              placeholder={type === 'expense' ? 'Ex.: Mercado, aluguel, transporte' : 'Ex.: Salário, freelance'}
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              maxLength={80}
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, fontFamily: fonts.regular }]}
            />
            <CategorySuggestionCard
              suggestion={categorization.suggestion}
              error={categorization.error}
              loading={categorization.loading}
              selectedCategoryId={categoryId}
              onApply={setCategoryId}
            />
          </View>
          </>
          )}

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>Categoria</Text>
            <View style={styles.chips}>
              {categories.map((category) => {
                const active = category.id === categoryId;
                return (
                  <Pressable
                    key={category.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setCategoryId(category.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? `${category.color}20` : colors.surface,
                        borderColor: active ? category.color : colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.chipDot, { backgroundColor: category.color }]} />
                    <Text style={[styles.chipText, { color: active ? colors.text : colors.textMuted, fontFamily: active ? fonts.semiBold : fonts.regular }]}>{category.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {imported ? null : (
          <>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>Conta</Text>
            <View style={styles.chips}>
              {accounts.map((account) => {
                const active = account.id === accountId;
                return (
                  <Pressable
                    key={account.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => setAccountId(account.id)}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? colors.text : colors.surface, borderColor: active ? colors.text : colors.border },
                    ]}
                  >
                    <View style={[styles.chipDot, { backgroundColor: account.color }]} />
                    <Text style={[styles.chipText, { color: active ? colors.background : colors.textMuted, fontFamily: active ? fonts.semiBold : fonts.regular }]}>{account.institution}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>Data</Text>
              <TextInput
                accessibilityLabel="Data da transação"
                value={date}
                onChangeText={setDate}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.textMuted}
                selectionColor={colors.primary}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, fontFamily: fonts.regular }]}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>Situação</Text>
              <View style={[styles.statusSelector, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {(['completed', 'pending'] as TransactionStatus[]).map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    onPress={() => setStatus(item)}
                    style={[styles.statusOption, { backgroundColor: status === item ? colors.surfaceElevated : 'transparent' }]}
                  >
                    <Text style={[styles.statusText, { color: status === item ? colors.text : colors.textMuted, fontFamily: fonts.medium }]}>{item === 'completed' ? 'Concluída' : 'Pendente'}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          </>
          )}

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>Recorrência</Text>
            <View style={styles.chips}>
              {recurrenceOptions.map((option) => {
                const active = recurrence === option.id;
                return (
                  <Pressable
                    key={option.id ?? 'none'}
                    accessibilityRole="button"
                    onPress={() => setRecurrence(option.id)}
                    style={[styles.chip, { backgroundColor: active ? colors.text : colors.surface, borderColor: active ? colors.text : colors.border }]}
                  >
                    <Text style={[styles.chipText, { color: active ? colors.background : colors.textMuted, fontFamily: active ? fonts.semiBold : fonts.regular }]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted, fontFamily: fonts.medium }]}>Observações (opcional)</Text>
            <TextInput
              accessibilityLabel="Observações da transação"
              value={notes}
              onChangeText={setNotes}
              placeholder="Inclua detalhes que ajudem você depois"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              multiline
              maxLength={300}
              style={[styles.notesInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, fontFamily: fonts.regular }]}
            />
          </View>

          {error ? <Text style={[styles.error, { color: colors.expense, fontFamily: fonts.medium }]}>{error}</Text> : null}
          <Button label={transaction ? 'Salvar alterações' : 'Adicionar transação'} icon="checkmark" onPress={save} style={styles.saveButton} />
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  typeSelector: { flexDirection: 'row', borderRadius: 18, padding: 4, marginBottom: 14 },
  lockedTitle: { fontSize: 17, marginTop: 4 },
  lockedAmount: { fontSize: 26, marginTop: 8 },
  lockedMeta: { fontSize: 12, lineHeight: 18, marginTop: 8 },
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
  notesInput: { minHeight: 100, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingVertical: 14, fontSize: 14, textAlignVertical: 'top', outlineStyle: 'none' } as never,
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12 },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 12 },
  statusSelector: { minHeight: 52, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 4, flexDirection: 'row' },
  statusOption: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 10 },
  error: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  saveButton: { marginTop: 4 },
});
