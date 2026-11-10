import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAppTheme } from '@/theme/AppTheme';
import { amountInputToCents, centsToAmountInput, formatAmountInput } from '@/utils/format';
import { useFinance } from './FinanceContext';
import type { Account, AccountType } from './types';

const accountTypes: Array<{ id: AccountType; label: string }> = [
  { id: 'checking', label: 'Conta corrente' },
  { id: 'savings', label: 'Reserva' },
  { id: 'investment', label: 'Investimentos' },
  { id: 'cash', label: 'Dinheiro' },
];

const accountColors = ['#8B7CFF', '#F97316', '#4ADE80', '#34D399', '#38BDF8', '#EC4899'];

interface AccountFormProps {
  account?: Account;
  canDelete?: boolean;
  onDelete?: () => void;
}

export function AccountForm({ account, canDelete = false, onDelete }: AccountFormProps) {
  const { addAccount, updateAccount } = useFinance();
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const [name, setName] = useState(account?.name ?? '');
  const [institution, setInstitution] = useState(account?.institution ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? 'checking');
  const [color, setColor] = useState(account?.color ?? accountColors[0]!);
  const [balanceDigits, setBalanceDigits] = useState(centsToAmountInput(account?.openingBalanceCents ?? 0));
  const [error, setError] = useState('');

  function save() {
    if (!name.trim()) return setError('Dê um nome para identificar a conta.');
    if (!institution.trim()) return setError('Informe a instituição ou carteira.');
    const draft = {
      name: name.trim(),
      institution: institution.trim(),
      type,
      color,
      // Conta importada: o saldo inicial é ajustado pela sincronização (pode ser negativo).
      openingBalanceCents: account?.externalId ? account.openingBalanceCents : amountInputToCents(balanceDigits),
    };
    if (account) updateAccount(account.id, draft);
    else addAccount(draft);
    router.back();
  }

  return (
    <Screen>
      <ScreenHeader title={account ? 'Editar conta' : 'Nova conta'} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card style={styles.previewCard}>
          <View style={[styles.previewLogo, { backgroundColor: `${color}20` }]}>
            <View style={[styles.previewLogoInner, { backgroundColor: color }]} />
          </View>
          <Text style={[styles.previewInstitution, { color: colors.textMuted, fontFamily: fonts.regular }]}>{institution || 'Instituição'}</Text>
          <Text style={[styles.previewName, { color: colors.text, fontFamily: fonts.semiBold }]}>{name || 'Nome da conta'}</Text>
        </Card>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.medium }]}>Nome da conta</Text>
          <TextInput
            accessibilityLabel="Nome da conta"
            value={name}
            onChangeText={setName}
            placeholder="Ex.: Conta principal"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            maxLength={40}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, fontFamily: fonts.regular }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.medium }]}>Instituição</Text>
          <TextInput
            accessibilityLabel="Instituição da conta"
            value={institution}
            onChangeText={setInstitution}
            placeholder="Ex.: Nubank, Inter, Carteira"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.primary}
            maxLength={40}
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, fontFamily: fonts.regular }]}
          />
        </View>

        {account?.externalId ? (
          <Text style={[styles.hint, styles.field, { color: colors.textMuted, fontFamily: fonts.regular }]}>
            Conta do Open Finance: o tipo e o saldo vêm do banco a cada sincronização. Aqui você muda só o nome, a instituição e a cor.
          </Text>
        ) : (
        <>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.medium }]}>Tipo</Text>
          <View style={styles.chips}>
            {accountTypes.map((item) => {
              const active = item.id === type;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setType(item.id)}
                  style={[styles.chip, { backgroundColor: active ? colors.text : colors.surface, borderColor: active ? colors.text : colors.border }]}
                >
                  <Text style={[styles.chipText, { color: active ? colors.background : colors.textMuted, fontFamily: active ? fonts.semiBold : fonts.regular }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.medium }]}>Saldo inicial</Text>
          <View style={[styles.balanceInput, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.currency, { color: colors.textMuted, fontFamily: fonts.medium }]}>R$</Text>
            <TextInput
              accessibilityLabel="Saldo inicial da conta"
              value={formatAmountInput(balanceDigits)}
              onChangeText={(value) => setBalanceDigits(value.replace(/\D/g, '').slice(0, 14))}
              keyboardType="numeric"
              placeholder="0,00"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              style={[styles.balanceTextInput, { color: colors.text, fontFamily: fonts.semiBold }]}
            />
          </View>
          <Text style={[styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }]}>As transações concluídas serão somadas ou subtraídas deste valor.</Text>
        </View>
        </>
        )}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted, fontFamily: fonts.medium }]}>Cor de identificação</Text>
          <View style={styles.colorOptions}>
            {accountColors.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityLabel={`Selecionar cor ${item}`}
                accessibilityState={{ selected: color === item }}
                onPress={() => setColor(item)}
                style={[styles.colorOption, { backgroundColor: item, borderColor: color === item ? colors.text : 'transparent' }]}
              >
                {color === item ? <View style={styles.selectedColor} /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        {error ? <Text style={[styles.error, { color: colors.expense, fontFamily: fonts.medium }]}>{error}</Text> : null}
        <Button label={account ? 'Salvar alterações' : 'Criar conta'} icon="checkmark" onPress={save} style={styles.saveButton} />
        {account && onDelete ? (
          <>
            <Button label="Excluir conta" icon="trash-outline" variant="ghost" onPress={onDelete} disabled={!canDelete} style={styles.deleteButton} />
            {!canDelete ? <Text style={[styles.deleteHint, { color: colors.textMuted, fontFamily: fonts.regular }]}>Exclua ou mova as transações vinculadas antes de excluir esta conta.</Text> : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  previewCard: { alignItems: 'center', marginBottom: 24 },
  previewLogo: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  previewLogoInner: { width: 19, height: 19, borderRadius: 10 },
  previewInstitution: { fontSize: 12, marginTop: 12 },
  previewName: { fontSize: 19, marginTop: 4 },
  field: { marginBottom: 21 },
  label: { fontSize: 12, marginBottom: 9 },
  input: { minHeight: 52, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingVertical: 13, fontSize: 14, outlineStyle: 'none' } as never,
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13 },
  chipText: { fontSize: 12 },
  balanceInput: { minHeight: 58, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  currency: { fontSize: 16 },
  balanceTextInput: { flex: 1, minWidth: 0, fontSize: 22, paddingVertical: 10, outlineStyle: 'none' } as never,
  hint: { fontSize: 11, lineHeight: 17, marginTop: 8 },
  colorOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorOption: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  selectedColor: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#09090B' },
  error: { fontSize: 13, marginBottom: 14 },
  saveButton: { marginTop: 4 },
  deleteButton: { marginTop: 10 },
  deleteHint: { fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 10 },
});
