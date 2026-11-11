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
import { SectionHeader } from '@/components/SectionHeader';
import { useFinance } from '@/features/finance/FinanceContext';
import { getAccountBalance, getTotalBalance, isLiability } from '@/features/finance/selectors';
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
  // Contas com dinheiro primeiro; cartões e empréstimos (dívidas, fora do saldo) à parte.
  const groups = [
    { title: 'Contas', items: accounts.filter((account) => !isLiability(account)) },
    { title: 'Cartões e empréstimos', items: accounts.filter(isLiability) },
  ].filter((group) => group.items.length > 0);

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
          groups.map((group) => (
            <View key={group.title} style={styles.group}>
              <SectionHeader title={group.title} />
              <Card style={styles.groupCard}>
                {group.items.map((account, index) => {
                  const transactionCount = transactions.filter((transaction) => transaction.accountId === account.id).length;
                  return (
                    <Pressable
                      key={account.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Editar conta ${account.name}`}
                      onPress={() => router.push(`/accounts/${account.id}/edit`)}
                      style={({ pressed }) => [
                        styles.accountRow,
                        { borderBottomColor: colors.border, borderBottomWidth: index < group.items.length - 1 ? StyleSheet.hairlineWidth : 0, opacity: pressed ? 0.65 : 1 },
                      ]}
                    >
                      <AccountLogo color={account.color} icon={account.icon} logoUrl={accountLogoUrl(account)} />
                      <View style={styles.accountContent}>
                        <Text numberOfLines={1} style={[styles.accountName, { color: colors.text, fontFamily: fonts.semiBold }]}>{account.name}</Text>
                        <Text numberOfLines={2} style={[styles.accountMeta, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                          {account.institution} · {typeLabels[account.type]} · {transactionCount} {transactionCount === 1 ? 'transação' : 'transações'}
                        </Text>
                      </View>
                      <AmountText cents={getAccountBalance(account, transactions)} style={styles.balance} />
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </Pressable>
                  );
                })}
              </Card>
            </View>
          ))
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
  group: { marginTop: 22 },
  groupCard: { paddingTop: 4, paddingBottom: 4 },
  accountRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  accountContent: { flex: 1, minWidth: 0 },
  accountName: { fontSize: 14 },
  accountMeta: { fontSize: 11, marginTop: 4 },
  balance: { fontSize: 13 },
  note: { fontSize: 11, textAlign: 'center', marginTop: 22 },
});
