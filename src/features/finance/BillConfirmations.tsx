import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { useAppTheme } from '@/theme/AppTheme';
import { parseLocalDate, toDateInput } from '@/utils/format';
import { overdueBills } from './bills';
import { useFinance } from './FinanceContext';

function shortDate(value: string): string {
  return parseLocalDate(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * Aviso no Início com as contas que venceram sem confirmação. Vencer não quita: o usuário diz
 * "Já paguei" ou "Ainda não" (a conta segue a pagar, marcada como atrasada, até ele confirmar).
 */
export function BillConfirmations() {
  const { bills, setBillPaid } = useFinance();
  const { colors, fonts } = useAppTheme();
  const overdue = overdueBills(bills, toDateInput());
  if (overdue.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.warning }]}>
      <View style={styles.header}>
        <Ionicons name="notifications-outline" size={20} color={colors.warning} />
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>Confirmar pagamentos</Text>
      </View>
      {overdue.map(({ bill, monthKey, date, acknowledged }) => (
        <View key={`${bill.id}:${monthKey}`} style={[styles.row, { borderTopColor: colors.border }]}>
          <View style={styles.info}>
            <Text numberOfLines={1} style={[styles.name, { color: colors.text, fontFamily: fonts.medium }]}>{bill.description}</Text>
            <Text style={[styles.meta, { color: acknowledged ? colors.expense : colors.textMuted, fontFamily: fonts.regular }]}>
              {acknowledged ? `Atrasada desde ${shortDate(date)}` : `Venceu ${shortDate(date)}`}
            </Text>
          </View>
          <AmountText cents={bill.amountCents} style={styles.amount} />
          <View style={styles.actions}>
            {acknowledged ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${bill.description}: ainda não paguei`}
                onPress={() => setBillPaid(bill.id, monthKey, false)}
                style={({ pressed }) => [styles.action, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.actionText, { color: colors.textMuted, fontFamily: fonts.medium }]}>Ainda não</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${bill.description}: já paguei`}
              onPress={() => setBillPaid(bill.id, monthKey, true)}
              style={({ pressed }) => [styles.action, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.actionText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>Já paguei</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { flex: 1, fontSize: 14 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  info: { flex: 1, minWidth: 120 },
  name: { fontSize: 13 },
  meta: { fontSize: 11, marginTop: 2 },
  amount: { fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8, width: '100%', justifyContent: 'flex-end' },
  action: { minHeight: 44, paddingHorizontal: 16, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 12 },
});
