import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Toggle } from '@/components/Toggle';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useFinance } from '@/features/finance/FinanceContext';
import { describeImport } from '@/features/openfinance/merge';
import { institutionsNeedingLogo, parseItemIds, validateOpenFinanceSettings } from '@/features/openfinance/normalize';
import type { OpenFinanceSettings } from '@/features/openfinance/types';
import { useOpenFinanceSettings } from '@/features/openfinance/useOpenFinanceSettings';
import { OPEN_FINANCE_ERROR_MESSAGES, SYNC_WINDOW_DAYS, syncOpenFinance } from '@/services/openFinance';
import { useAppTheme } from '@/theme/AppTheme';
import { confirmAction } from '@/utils/confirm';
import { toDateInput } from '@/utils/format';
import { SECRETS_ARE_ENCRYPTED } from '@/utils/secureStore';

const STEPS = [
  'Em meu.pluggy.ai, conecte seus bancos (é gratuito).',
  'No painel do Pluggy (dashboard.pluggy.ai), crie uma aplicação de desenvolvimento com o conector MeuPluggy.',
  'Na Demo da aplicação, autorize o MeuPluggy uma vez por banco e toque em "Copiar Item ID".',
  'Cole abaixo o Client ID, o Client Secret e os Item IDs.',
];

function formatSyncDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
  const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
  return `${day} às ${time}`;
}

export default function OpenFinanceScreen() {
  const { settings, hydrated, loadError, save, clear } = useOpenFinanceSettings();
  const { importOpenFinance, accounts } = useFinance();
  const { colors, fonts } = useAppTheme();
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [itemIdsText, setItemIdsText] = useState('');
  const [consentedAt, setConsentedAt] = useState<string | undefined>();
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null);
  const [busy, setBusy] = useState<'saving' | 'syncing' | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const hasSaved = Boolean(settings.clientId || settings.clientSecret || settings.itemIds.length > 0);

  useEffect(() => {
    if (!hydrated) return;
    setClientId(settings.clientId);
    setClientSecret(settings.clientSecret);
    setItemIdsText(settings.itemIds.join('\n'));
    setConsentedAt(settings.consentedAt);
  }, [hydrated, settings]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  function draft(): OpenFinanceSettings {
    return { ...settings, clientId: clientId.trim(), clientSecret: clientSecret.trim(), itemIds: parseItemIds(itemIdsText), consentedAt };
  }

  function validDraft(): OpenFinanceSettings | null {
    const next = draft();
    const error = validateOpenFinanceSettings(next);
    if (error) {
      setMessage({ text: error, tone: 'error' });
      return null;
    }
    return next;
  }

  async function submit() {
    const next = validDraft();
    if (!next) return;
    setBusy('saving');
    try {
      await save(next);
      setMessage({ text: 'Conexão salva.', tone: 'ok' });
    } catch {
      setMessage({ text: 'Não foi possível salvar no aparelho. Tente de novo.', tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    const next = validDraft();
    if (!next) return;
    if (!next.consentedAt) return setMessage({ text: 'Autorize a busca dos dados antes de sincronizar.', tone: 'error' });
    setBusy('syncing');
    setMessage(null);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await save(next);
      const outcome = await syncOpenFinance(next, toDateInput(), { signal: controller.signal }, institutionsNeedingLogo(accounts));
      if (controller.signal.aborted) return;
      if (!outcome.ok) {
        const detail = outcome.itemId ? ` (${outcome.itemId.slice(0, 8)}…)` : '';
        setMessage({ text: `${OPEN_FINANCE_ERROR_MESSAGES[outcome.error]}${detail}`, tone: 'error' });
        return;
      }
      const report = importOpenFinance(outcome.snapshot);
      await save({ ...next, lastSync: { ...report, at: new Date().toISOString(), warnings: outcome.snapshot.warnings } });
      setMessage({ text: `Sincronizado: ${describeImport(report)}.`, tone: 'ok' });
    } catch {
      setMessage({ text: 'Os dados vieram, mas não foi possível salvar o resumo. Tente de novo.', tone: 'error' });
    } finally {
      if (!controller.signal.aborted) setBusy(null);
    }
  }

  const inputStyle = [styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, fontFamily: fonts.regular }];
  const labelStyle = [styles.label, { color: colors.textMuted, fontFamily: fonts.medium }];
  const hintStyle = [styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }];
  const lastSync = settings.lastSync;

  return (
    <Screen>
      <ScreenHeader title="Open Finance" subtitle="Suas contas pelo MeuPluggy" showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.row}>
            <Ionicons name="git-network-outline" size={22} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Como conectar</Text>
          </View>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.step}>
              <Text style={[styles.stepNumber, { color: colors.primary, fontFamily: fonts.semiBold }]}>{index + 1}</Text>
              <Text style={[styles.stepText, { color: colors.textMuted, fontFamily: fonts.regular }]}>{step}</Text>
            </View>
          ))}
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Credenciais do Pluggy" />
          <Text style={labelStyle}>Client ID</Text>
          <TextInput
            accessibilityLabel="Client ID do Pluggy"
            value={clientId}
            onChangeText={(value) => {
              setClientId(value);
              setMessage(null);
            }}
            placeholder="Cole o Client ID"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
          <Text style={[labelStyle, styles.spaced]}>Client Secret</Text>
          <TextInput
            accessibilityLabel="Client Secret do Pluggy"
            value={clientSecret}
            onChangeText={(value) => {
              setClientSecret(value);
              setMessage(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={inputStyle}
          />
          <Text style={hintStyle}>
            {SECRETS_ARE_ENCRYPTED
              ? 'O Client ID e o Client Secret ficam criptografados no armazenamento seguro do aparelho e só vão para a API do Pluggy.'
              : 'No navegador o segredo fica sem criptografia e o Pluggy pode bloquear a chamada. Use no celular.'}
          </Text>
          <Text style={[labelStyle, styles.spaced]}>Item IDs (um por banco)</Text>
          <TextInput
            accessibilityLabel="Item IDs do Pluggy"
            value={itemIdsText}
            onChangeText={(value) => {
              setItemIdsText(value);
              setMessage(null);
            }}
            placeholder="Um por linha"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={[inputStyle, styles.multiline]}
          />
        </View>

        <Card style={styles.section}>
          <View style={styles.row}>
            <Text style={[styles.consent, { color: colors.text, fontFamily: fonts.regular }]}>
              Autorizo o HexFin a buscar no Pluggy minhas contas, cartões, empréstimos e as transações dos últimos {SYNC_WINDOW_DAYS} dias. Os dados ficam só neste aparelho.
            </Text>
            <Toggle
              accessibilityLabel="Autorizar busca no Open Finance"
              value={Boolean(consentedAt)}
              onValueChange={(on) => {
                setConsentedAt(on ? new Date().toISOString() : undefined);
                setMessage(null);
              }}
            />
          </View>
        </Card>

        {loadError ? <Text style={[styles.message, { color: colors.expense, fontFamily: fonts.medium }]}>Não foi possível ler a conexão salva.</Text> : null}
        {message ? (
          <Text style={[styles.message, { color: message.tone === 'error' ? colors.expense : colors.income, fontFamily: fonts.medium }]}>{message.text}</Text>
        ) : null}
        <Button label="Sincronizar agora" icon="sync-outline" onPress={sync} loading={busy === 'syncing'} disabled={!hydrated || busy !== null} style={styles.section} />
        <Button label="Salvar" icon="checkmark" variant="secondary" onPress={submit} loading={busy === 'saving'} disabled={!hydrated || busy !== null} style={styles.spaced} />

        {lastSync ? (
          <Card style={styles.section}>
            <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Última sincronização</Text>
            <Text style={hintStyle}>{formatSyncDate(lastSync.at)} · {describeImport(lastSync)}</Text>
            {lastSync.warnings.map((warning) => (
              <Text key={warning} style={hintStyle}>{warning}</Text>
            ))}
          </Card>
        ) : null}

        <Card style={styles.section}>
          <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>O que acontece com os dados</Text>
          <Text style={hintStyle}>O saldo de cada conta fica igual ao que o banco informa. Cartões e empréstimos aparecem como dívida e não entram no saldo das contas.</Text>
          <Text style={hintStyle}>Pagamento de fatura vira transferência para o cartão e não conta como gasto, porque as compras do cartão já contaram.</Text>
          <Text style={hintStyle}>A categoria que você mudar numa transação importada é mantida nas próximas sincronizações. O MeuPluggy atualiza os bancos uma vez por dia.</Text>
        </Card>

        {hasSaved ? (
          <Button
            label="Remover conexão"
            icon="trash-outline"
            variant="ghost"
            disabled={busy !== null}
            onPress={() =>
              confirmAction('Remover a conexão?', 'O Client ID, o Client Secret e os Item IDs serão apagados deste aparelho. As contas e transações já importadas continuam no app.', 'Remover', () => {
                clear()
                  .then(() => setMessage({ text: 'Conexão removida.', tone: 'ok' }))
                  .catch(() => setMessage({ text: 'Não foi possível remover. Tente de novo.', tone: 'error' }));
              })
            }
            style={styles.spaced}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 16 },
  step: { flexDirection: 'row', gap: 10, marginTop: 10 },
  stepNumber: { fontSize: 13, width: 14 },
  stepText: { flex: 1, fontSize: 12, lineHeight: 18 },
  section: { marginTop: 22 },
  label: { fontSize: 12, marginBottom: 9 },
  input: { minHeight: 52, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingVertical: 13, fontSize: 14, outlineStyle: 'none' } as never,
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  hint: { fontSize: 11, lineHeight: 17, marginTop: 8 },
  spaced: { marginTop: 16 },
  consent: { flex: 1, fontSize: 13, lineHeight: 19 },
  message: { fontSize: 13, marginTop: 18 },
});
