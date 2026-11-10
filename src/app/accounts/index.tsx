import { Ionicons } from '@expo/vector-icons';
import { AccountLogo } from '@/components/AccountLogo';
import { accountLogoUrl } from '@/features/openfinance/normalize';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useFinance } from '@/features/finance/FinanceContext';
import { getAccountBalance, getTotalBalance } from '@/features/finance/selectors';
import type { AccountType } from '@/features/finance/types';
import { useAppTheme } from '@/theme/AppTheme';

const typeLabels: Record<AccountType, string> = {
  checking: 'Conta corrente',
  savings: 'Reserva',
  investment: 'Investimentos',
  cash: 'Dinheiro',
  credit: 'Cartão de crédito',
  loan: 'Empréstimo',
};

export default function AccountsScreen() {
  const { accounts, transactions } = useFinance();
  const { colors, fonts } = useAppTheme();
  const router = useRouter();

  return (
    <Screen>
      <ScreenHeader title="Minhas contas" showBack right={<IconButton icon="add" label="Nova conta" onPress={() => router.push('/accounts/new')} filled />} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={[styles.totalCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
          <Text style={[styles.totalLabel, { color: colors.primaryText, fontFamily: fonts.medium }]}>Saldo consolidado</Text>
          <AmountText cents={getTotalBalance(accounts, transactions)} color={colors.primaryText} style={styles.totalValue} />
          <Text style={[styles.totalCaption, { color: colors.primaryText, fontFamily: fonts.regular }]}>Considera apenas transações concluídas</Text>
        </Card>

        {accounts.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState icon="wallet-outline" title="Nenhuma conta ainda" description="Crie sua primeira conta para começar a organizar seu dinheiro." actionLabel="Criar conta" onAction={() => router.push('/accounts/new')} />
          </Card>
        ) : (
          <View style={styles.list}>
            {accounts.map((account) => {
              const transactionCount = transactions.filter((transaction) => transaction.accountId === account.id).length;
              return (
                <Pressable key={account.id} accessibilityRole="button" accessibilityLabel={`Editar conta ${account.name}`} onPress={() => router.push(`/accounts/${account.id}/edit`)} style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1 })}>
                  <Card style={styles.accountCard}>
                    <AccountLogo color={account.color} icon={account.icon} logoUrl={accountLogoUrl(account)} />
                    <View style={styles.accountContent}>
                      <Text style={[styles.institution, { color: colors.textMuted, fontFamily: fonts.regular }]}>{account.institution}</Text>
                      <Text style={[styles.accountName, { color: colors.text, fontFamily: fonts.semiBold }]}>{account.name}</Text>
                      <Text style={[styles.accountMeta, { color: colors.textMuted, fontFamily: fonts.regular }]}>{typeLabels[account.type]} · {transactionCount} transações</Text>
                    </View>
                    <View style={styles.balanceContainer}>
                      <AmountText cents={getAccountBalance(account, transactions)} style={styles.balance} />
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={styles.chevron} />
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}
        <Text style={[styles.note, { color: colors.textMuted, fontFamily: fonts.regular }]}>Toque em uma conta para editar seus dados ou saldo inicial.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  totalCard: { padding: 22 },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 32, letterSpacing: -1, marginTop: 10 },
  totalCaption: { fontSize: 11, marginTop: 12 },
  emptyCard: { marginTop: 18 },
  list: { gap: 11, marginTop: 22 },
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  accountContent: { flex: 1, minWidth: 0 },
  institution: { fontSize: 10 },
  accountName: { fontSize: 14, marginTop: 3 },
  accountMeta: { fontSize: 10, marginTop: 5 },
  balanceContainer: { alignItems: 'flex-end' },
  balance: { fontSize: 12 },
  chevron: { marginTop: 7 },
  note: { fontSize: 11, textAlign: 'center', marginTop: 22 },
});
