import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AmountText } from '@/components/AmountText';
import { AccountLogo } from '@/components/AccountLogo';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CashFlowChart } from '@/components/CashFlowChart';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { GlowBackground } from '@/components/GlowBackground';
import { IconButton } from '@/components/IconButton';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { TransactionItem } from '@/components/TransactionItem';
import { getMonthAhead } from '@/features/finance/ahead';
import { BillConfirmations } from '@/features/finance/BillConfirmations';
import { visibleInsights } from '@/features/finance/assistants';
import { useFinance } from '@/features/finance/FinanceContext';
import {
  buildInsights,
  getCashFlow,
  getTotalBalance,
  getCurrentMonthKey,
  getSpendingByCategory,
  sortTransactions,
} from '@/features/finance/selectors';
import type { Account } from '@/features/finance/types';
import { useOpenFinanceSettings } from '@/features/openfinance/useOpenFinanceSettings';
import { useQuickSync } from '@/features/openfinance/useQuickSync';
import { UpdateBanner } from '@/features/update/UpdateBanner';
import { useAppTheme } from '@/theme/AppTheme';
import { greetingForHour, parseLocalDate, toDateInput } from '@/utils/format';

type Segment = 'accounts' | 'investments';

const SEGMENTS: Array<{ id: Segment; label: string }> = [
  { id: 'accounts', label: 'Contas' },
  { id: 'investments', label: 'Investimentos' },
];

function inSegment(account: Account, segment: Segment): boolean {
  return segment === 'investments' ? account.type === 'investment' : account.type !== 'investment';
}

export default function HomeScreen() {
  const data = useFinance();
  const { accounts, transactions, profile, toggleBalances, bills } = data;
  const { colors, fonts } = useAppTheme();
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>('accounts');
  const openFinance = useOpenFinanceSettings();
  // Depois de conectar, o Open Finance vira só o botão pequeno de sincronizar no topo.
  const openFinanceConnected = openFinance.settings.itemIds.length > 0;
  const quickSync = useQuickSync(openFinance.settings, openFinance.save);
  const openFinanceLabel = openFinanceConnected ? 'Sincronizar Open Finance' : 'Conectar Open Finance';

  const monthKey = getCurrentMonthKey();
  const segmentAccounts = accounts.filter((account) => inSegment(account, segment));
  // Cartões e empréstimos aparecem na lista, mas não somam no saldo (são dívidas).
  const segmentBalance = getTotalBalance(segmentAccounts, transactions);
  const insights = visibleInsights(buildInsights(data, monthKey), profile.disabledAssistants);
  const categories = getSpendingByCategory(transactions, monthKey);
  // Recentes = o que já aconteceu; agendados e parcelas futuras ficam na aba Recorrentes.
  const today = toDateInput();
  const recentTransactions = sortTransactions(transactions.filter((transaction) => transaction.date <= today)).slice(0, 5);
  const firstName = profile.name.trim().split(/\s+/)[0];
  const greeting = greetingForHour(new Date().getHours());
  const initial = firstName?.charAt(0).toLocaleUpperCase('pt-BR') || 'H';
  // De hoje até o fim do mês: o que ainda vai entrar e sair (o que já passou fica em Atividades).
  const ahead = getMonthAhead(data, today);
  const untilLabel = parseLocalDate(ahead.until).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const countLabel = (count: number) => (count === 0 ? 'Nada previsto' : `${count} ${count === 1 ? 'previsto' : 'previstos'}`);

  return (
    <Screen>
      <GlowBackground />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
            onPress={() => router.push('/profile')}
          >
            <ProfileAvatar initial={initial} photoUri={profile.photoUri} size={46} />
          </Pressable>
          <View style={styles.topActions}>
            {openFinanceConnected ? (
              quickSync.busy ? (
                <View accessibilityLabel="Sincronizando o Open Finance" style={[styles.syncButton, { backgroundColor: colors.surfaceElevated }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <IconButton
                  icon="sync-outline"
                  label="Sincronizar Open Finance"
                  onPress={() => (quickSync.ready ? quickSync.sync() : router.push('/open-finance'))}
                  filled
                />
              )
            ) : null}
            <IconButton
              icon={profile.hideBalances ? 'eye-off-outline' : 'eye-outline'}
              label={profile.hideBalances ? 'Mostrar valores' : 'Ocultar valores'}
              onPress={toggleBalances}
              filled
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Configurar inteligência artificial"
              onPress={() => router.push('/ai/settings')}
              style={[styles.aiPill, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.aiPillText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>IA</Text>
              <Ionicons name="sparkles" size={16} color={colors.primaryText} />
            </Pressable>
          </View>
        </View>

        <UpdateBanner />

        {quickSync.message ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={quickSync.message.tone === 'error' ? 'Abrir o Open Finance' : 'Fechar aviso'}
            onPress={() => {
              quickSync.dismiss();
              if (quickSync.message?.tone === 'error') router.push('/open-finance');
            }}
            style={[styles.syncMessage, { backgroundColor: colors.surface, borderColor: quickSync.message.tone === 'error' ? colors.expense : colors.border }]}
          >
            <Ionicons
              name={quickSync.message.tone === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
              size={16}
              color={quickSync.message.tone === 'error' ? colors.expense : colors.income}
            />
            <Text numberOfLines={2} style={[styles.syncMessageText, { color: colors.text, fontFamily: fonts.regular }]}>{quickSync.message.text}</Text>
          </Pressable>
        ) : null}

        <View style={styles.segments}>
          {SEGMENTS.map((item) => {
            const active = item.id === segment;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setSegment(item.id)}
                style={[styles.segment, { backgroundColor: active ? colors.text : colors.surface, borderColor: active ? colors.text : colors.border }]}
              >
                <Text style={[styles.segmentText, { color: active ? colors.background : colors.text, fontFamily: fonts.medium }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.greeting, { color: colors.text, fontFamily: fonts.semiBold }]}>
          {greeting}
          {firstName ? `, ${firstName}` : ''}
        </Text>

        <View style={styles.content}>
          {segmentAccounts.length === 0 ? (
            <Card style={styles.mainCard}>
              <View style={[styles.emptyIcon, { backgroundColor: `${colors.primary}26` }]}>
                <Ionicons name={segment === 'investments' ? 'trending-up' : 'wallet'} size={26} color={colors.primary} />
              </View>
              <Text style={[styles.mainTitle, { color: colors.text, fontFamily: fonts.regular }]}>
                {segment === 'investments'
                  ? 'Cadastre seus investimentos para acompanhar o patrimônio'
                  : 'Cadastre suas contas e descubra para onde seu dinheiro está indo'}
              </Text>
              <Text style={[styles.mainCaption, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                Tudo fica guardado só neste celular.
              </Text>
              {segment === 'investments' ? (
                <Button label="Adicionar investimento" icon="add" onPress={() => router.push('/accounts/new')} />
              ) : (
                <>
                  <Button label={openFinanceLabel} icon="git-network-outline" onPress={() => router.push('/open-finance')} />
                  <Button label="Cadastrar conta à mão" variant="ghost" onPress={() => router.push('/accounts/new')} style={styles.secondaryAction} />
                </>
              )}
            </Card>
          ) : (
            <Card style={styles.mainCard}>
              <Pressable accessibilityRole="button" accessibilityLabel="Ver contas" onPress={() => router.push('/accounts')} style={styles.mainHeader}>
                <View style={styles.badges}>
                  {segmentAccounts.slice(0, 4).map((account, index) => (
                    <AccountLogo
                      key={account.id}
                      color={account.color}
                      icon={account.icon}
                      logoUrl={account.logoUrl}
                      initial={account.institution.charAt(0).toLocaleUpperCase('pt-BR')}
                      size={40}
                      style={[styles.badge, { borderColor: colors.surface, marginLeft: index === 0 ? 0 : -12 }]}
                    />
                  ))}
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </Pressable>
              <Text style={[styles.mainLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                {segment === 'investments' ? 'Saldo em investimentos' : 'Saldo em contas'}
              </Text>
              <AmountText cents={segmentBalance} style={styles.mainValue} />
              <Text style={[styles.mainCaption, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                {segmentAccounts.length} {segmentAccounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}
              </Text>
              {openFinanceConnected ? null : (
                <Button label={openFinanceLabel} icon="git-network-outline" onPress={() => router.push('/open-finance')} />
              )}
            </Card>
          )}

          {transactions.length > 0 || bills.length > 0 ? (
            <View style={styles.summaryRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Ver o que vou receber" onPress={() => router.push('/ahead?side=receivable')} style={styles.summaryPress}>
                <Card style={styles.summaryCard}>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>A receber até {untilLabel}</Text>
                  <AmountText cents={ahead.receivableCents} color={colors.income} style={styles.summaryValue} />
                  <Text style={[styles.summaryLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>{countLabel(ahead.receivable.length)}</Text>
                </Card>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Ver o que vou pagar" onPress={() => router.push('/ahead?side=payable')} style={styles.summaryPress}>
                <Card style={styles.summaryCard}>
                  <Text style={[styles.summaryLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>A pagar</Text>
                  <AmountText cents={ahead.payableCents} color={colors.expense} style={styles.summaryValue} />
                  <Text style={[styles.summaryLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>{countLabel(ahead.payable.length)}</Text>
                </Card>
              </Pressable>
            </View>
          ) : null}

          <BillConfirmations />

          {insights.length > 0 ? (
            <View style={styles.section}>
              <SectionHeader title="Assistentes" actionLabel="Ver todos" onAction={() => router.push('/insights')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.insightList}>
                {insights.map((insight) => {
                  const tint = insight.tone === 'positive' ? colors.income : insight.tone === 'warning' ? colors.warning : colors.primary;
                  return (
                    <Card key={insight.id} style={styles.insightCard}>
                      <View style={[styles.insightIcon, { backgroundColor: `${tint}22` }]}>
                        <Ionicons name={insight.icon as keyof typeof Ionicons.glyphMap} size={30} color={tint} />
                      </View>
                      <View>
                        <Text style={[styles.insightTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>{insight.title}</Text>
                        <Text numberOfLines={4} style={[styles.insightText, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                          {insight.description}
                        </Text>
                      </View>
                    </Card>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {transactions.length > 0 ? (
            <>
              <View style={styles.section}>
                <SectionHeader title="Fluxo de caixa" actionLabel="6 meses" />
                <Card>
                  <CashFlowChart points={getCashFlow(transactions)} />
                </Card>
              </View>
              {categories.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader title="Gastos por categoria" actionLabel="Detalhes" onAction={() => router.push('/insights')} />
                  <Card>
                    <CategoryBreakdown items={categories} />
                  </Card>
                </View>
              ) : null}
              <View style={styles.section}>
                <SectionHeader title="Transações recentes" actionLabel="Ver todas" onAction={() => router.push('/transactions')} />
                <Card style={styles.recentCard}>
                  {recentTransactions.map((transaction, index) => (
                    <TransactionItem key={transaction.id} transaction={transaction} showDate bordered={index < recentTransactions.length - 1} />
                  ))}
                </Card>
              </View>
            </>
          ) : accounts.length > 0 ? (
            <Card style={styles.section}>
              <Text style={[styles.mainCaption, { color: colors.textMuted, fontFamily: fonts.regular }]}>
                Nenhuma transação ainda. Os gráficos e assistentes aparecem quando você registrar a primeira.
              </Text>
            </Card>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  secondaryAction: { marginTop: 8 },
  scrollContent: { paddingBottom: 32 },
  topBar: { paddingHorizontal: 20, paddingTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  syncButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  syncMessage: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 10 },
  syncMessageText: { flex: 1, fontSize: 12, lineHeight: 17 },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, borderRadius: 22, paddingHorizontal: 18 },
  aiPillText: { fontSize: 15 },
  segments: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, marginTop: 22 },
  segment: { minHeight: 44, justifyContent: 'center', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18 },
  segmentText: { fontSize: 14 },
  greeting: { fontSize: 36, letterSpacing: -1.2, paddingHorizontal: 20, marginTop: 24, marginBottom: 20 },
  content: { paddingHorizontal: 20 },
  mainCard: { gap: 14, padding: 22 },
  mainHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  badges: { flexDirection: 'row' },
  badge: { borderWidth: 2 },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  mainTitle: { fontSize: 20, lineHeight: 27 },
  mainLabel: { fontSize: 13 },
  mainValue: { fontSize: 32, letterSpacing: -1.1, marginTop: -8 },
  mainCaption: { fontSize: 13, lineHeight: 19 },
  summaryRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  summaryPress: { flex: 1 },
  summaryCard: { flex: 1, padding: 16 },
  summaryLabel: { fontSize: 12 },
  summaryValue: { fontSize: 18, marginTop: 8 },
  section: { marginTop: 28 },
  insightList: { gap: 12, paddingRight: 20 },
  insightCard: { width: 220, minHeight: 220, justifyContent: 'space-between' },
  insightIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  insightTitle: { fontSize: 16, marginBottom: 6 },
  insightText: { fontSize: 12, lineHeight: 17 },
  recentCard: { paddingTop: 8, paddingBottom: 8 },
});
