import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useAiSettings } from '@/features/ai/AiSettingsContext';
import { MODEL_PRESETS, validateAiSettings, type AiMode, type AiSettings } from '@/features/ai/config';
import { SECRETS_ARE_ENCRYPTED } from '@/features/ai/storage';
import { useAppTheme } from '@/theme/AppTheme';
import { confirmAction } from '@/utils/confirm';

const modeOptions: Array<{ id: AiMode; label: string }> = [
  { id: 'off', label: 'Desligada' },
  { id: 'direct', label: 'Chave própria' },
  { id: 'backend', label: 'Servidor' },
];

export default function AiSettingsScreen() {
  const { settings, hydrated, save, reset } = useAiSettings();
  const { colors, fonts } = useAppTheme();
  const [draft, setDraft] = useState<AiSettings>(settings);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (hydrated) setDraft(settings);
  }, [hydrated, settings]);

  function update(patch: Partial<AiSettings>) {
    setDraft((current) => ({ ...current, ...patch }));
    setMessage(null);
  }

  async function submit() {
    const error = validateAiSettings(draft);
    if (error) return setMessage({ text: error, tone: 'error' });
    setSaving(true);
    try {
      await save(draft);
      setMessage({ text: draft.mode === 'off' ? 'IA desligada.' : 'Configuração salva.', tone: 'ok' });
    } catch {
      setMessage({ text: 'Não foi possível salvar no aparelho. Tente de novo.', tone: 'error' });
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, fontFamily: fonts.regular }];
  const labelStyle = [styles.label, { color: colors.textMuted, fontFamily: fonts.medium }];
  const hintStyle = [styles.hint, { color: colors.textMuted, fontFamily: fonts.regular }];

  return (
    <Screen>
      <ScreenHeader title="Inteligência artificial" subtitle="Sugestões e comentários" showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Card>
          <View style={styles.row}>
            <Ionicons name="sparkles-outline" size={22} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text, fontFamily: fonts.semiBold }]}>Como funciona</Text>
          </View>
          <Text style={hintStyle}>
            Ao digitar a descrição de uma transação, o HexFin sugere uma categoria. Só a descrição e o tipo (receita ou despesa) são enviados. Você sempre confirma antes de usar a sugestão. Sem IA, o app usa regras locais.
          </Text>
          <Text style={hintStyle}>
            Se você autorizar à parte, a IA também comenta o mês na aba Assistentes. Para isso vão só percentuais calculados no app: quanto sobrou da renda, a variação dos gastos e a fatia de cada categoria. Valores em reais, contas e saldos nunca saem do aparelho.
          </Text>
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Modo" />
          <View style={styles.options}>
            {modeOptions.map((option) => (
              <Button
                key={option.id}
                label={option.label}
                variant={draft.mode === option.id ? 'primary' : 'secondary'}
                onPress={() => update({ mode: option.id })}
                style={styles.option}
              />
            ))}
          </View>
        </View>

        {draft.mode === 'direct' ? (
          <View style={styles.section}>
            <Text style={labelStyle}>Chave da API da Anthropic</Text>
            <TextInput
              accessibilityLabel="Chave da API"
              value={draft.apiKey}
              onChangeText={(apiKey) => update({ apiKey })}
              placeholder="sk-ant-…"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
            <Text style={hintStyle}>
              {SECRETS_ARE_ENCRYPTED
                ? 'A chave fica criptografada no armazenamento seguro do aparelho e é enviada só para a API da Anthropic.'
                : 'No navegador a chave fica no armazenamento local, sem criptografia. Prefira o app no celular.'}
            </Text>
            <Text style={[labelStyle, styles.spaced]}>Modelo</Text>
            <View style={styles.options}>
              {MODEL_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  label={preset.label}
                  variant={draft.model === preset.id ? 'primary' : 'secondary'}
                  onPress={() => update({ model: preset.id })}
                  style={styles.option}
                />
              ))}
            </View>
            <TextInput
              accessibilityLabel="ID do modelo"
              value={draft.model}
              onChangeText={(model) => update({ model })}
              autoCapitalize="none"
              autoCorrect={false}
              style={[inputStyle, styles.spacedSmall]}
            />
            <Text style={hintStyle}>{MODEL_PRESETS.find((preset) => preset.id === draft.model)?.hint ?? 'Modelo personalizado.'}</Text>
          </View>
        ) : null}

        {draft.mode === 'backend' ? (
          <View style={styles.section}>
            <Text style={labelStyle}>URL do servidor</Text>
            <TextInput
              accessibilityLabel="URL do servidor"
              value={draft.backendUrl}
              onChangeText={(backendUrl) => update({ backendUrl })}
              placeholder="https://seu-servidor.exemplo"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={inputStyle}
            />
            <Text style={[labelStyle, styles.spaced]}>Token do app</Text>
            <TextInput
              accessibilityLabel="Token do servidor"
              value={draft.backendToken}
              onChangeText={(backendToken) => update({ backendToken })}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
            <Text style={hintStyle}>O servidor guarda a chave da IA; o app só conhece este token (HEXFIN_APP_TOKEN).</Text>
          </View>
        ) : null}

        {draft.mode !== 'off' ? (
          <Card style={styles.section}>
            <View style={styles.row}>
              <Text style={[styles.consent, { color: colors.text, fontFamily: fonts.regular }]}>
                Autorizo enviar a descrição das transações {draft.mode === 'direct' ? 'para a Anthropic' : 'para o meu servidor'} para receber sugestões.
              </Text>
              <Switch
                accessibilityLabel="Autorizar envio da descrição"
                value={Boolean(draft.consentedAt)}
                onValueChange={(on) => update({ consentedAt: on ? new Date().toISOString() : undefined })}
                trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                thumbColor={draft.consentedAt ? colors.primaryText : colors.textMuted}
              />
            </View>
            <View style={[styles.row, styles.consentDivider, { borderTopColor: colors.border }]}>
              <Text style={[styles.consent, { color: colors.text, fontFamily: fonts.regular }]}>
                Autorizo enviar percentuais do mês (economia, variação e fatia de cada categoria) para a IA comentar na aba Assistentes. Valores em reais não saem.
              </Text>
              <Switch
                accessibilityLabel="Autorizar comentários do mês"
                value={Boolean(draft.insightsConsentedAt)}
                onValueChange={(on) => update({ insightsConsentedAt: on ? new Date().toISOString() : undefined })}
                trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
                thumbColor={draft.insightsConsentedAt ? colors.primaryText : colors.textMuted}
              />
            </View>
          </Card>
        ) : null}

        {message ? (
          <Text style={[styles.message, { color: message.tone === 'error' ? colors.expense : colors.income, fontFamily: fonts.medium }]}>{message.text}</Text>
        ) : null}
        <Button label="Salvar" icon="checkmark" onPress={submit} loading={saving} disabled={!hydrated} style={styles.section} />
        <Button
          label="Remover chaves e desligar"
          icon="trash-outline"
          variant="ghost"
          onPress={() =>
            confirmAction('Remover configuração da IA?', 'A chave e o token serão apagados deste aparelho.', 'Remover', () => {
              reset()
                .then(() => setMessage({ text: 'Configuração removida.', tone: 'ok' }))
                .catch(() => setMessage({ text: 'Não foi possível remover. Tente de novo.', tone: 'error' }));
            })
          }
          style={styles.spaced}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 16 },
  section: { marginTop: 22 },
  options: { flexDirection: 'row', gap: 7 },
  option: { flex: 1, minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 14 },
  label: { fontSize: 12, marginBottom: 9 },
  input: { minHeight: 52, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingVertical: 13, fontSize: 14, outlineStyle: 'none' } as never,
  hint: { fontSize: 11, lineHeight: 17, marginTop: 8 },
  spaced: { marginTop: 16 },
  spacedSmall: { marginTop: 8 },
  consent: { flex: 1, fontSize: 13, lineHeight: 19 },
  consentDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 14, paddingTop: 14 },
  message: { fontSize: 13, marginTop: 18 },
});
