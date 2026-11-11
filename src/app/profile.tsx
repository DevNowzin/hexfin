import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Toggle } from '@/components/Toggle';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/ListRow';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { useAiSettings } from '@/features/ai/AiSettingsContext';
import type { AiMode } from '@/features/ai/config';
import { ASSISTANTS, isAssistantEnabled, toggleAssistant } from '@/features/finance/assistants';
import { useFinance } from '@/features/finance/FinanceContext';
import { getCurrentMonthKey } from '@/features/finance/selectors';
import type { OpenFinanceSettings } from '@/features/openfinance/types';
import { useOpenFinanceSettings } from '@/features/openfinance/useOpenFinanceSettings';
import type { ThemePreference } from '@/features/finance/types';
import { useSecurity } from '@/features/security/SecurityContext';
import { computeMonthPay } from '@/features/work/payroll';
import { CURRENT_VERSION, type UpdateState, useAppUpdate } from '@/features/update/useAppUpdate';
import { pickProfilePhoto, removeProfilePhoto } from '@/services/profilePhoto';
import { useAppTheme } from '@/theme/AppTheme';
import { confirmAction } from '@/utils/confirm';
import { formatCurrency } from '@/utils/format';

type IconName = keyof typeof Ionicons.glyphMap;

const themeOptions: Array<{ id: ThemePreference; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
  { id: 'light', label: 'Claro', icon: 'sunny-outline' },
  { id: 'dark', label: 'Escuro', icon: 'moon-outline' },
];

const AI_MODE_LABELS: Record<AiMode, string> = {
  off: 'Desligada',
  direct: 'Ligada com a sua chave',
  backend: 'Ligada pelo seu servidor',
};

function updateStatus(state: UpdateState): string {
  if (state.status === 'checking') return 'Procurando…';
  if (state.status === 'available') return `Versão ${state.release.version} disponível: baixe pelo aviso no Início`;
  if (state.status === 'current') return 'Você está na versão mais nova';
  if (state.status === 'error') return state.error === 'offline' ? 'Sem internet. Toque para tentar de novo' : 'Não deu para procurar agora. Toque para tentar de novo';
  return 'Toque para procurar no GitHub';
}

function openFinanceStatus(settings: OpenFinanceSettings): string {
  if (settings.lastSync) {
    const date = new Date(settings.lastSync.at);
    if (!Number.isNaN(date.getTime())) {
      return `Sincronizado em ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)}`;
    }
  }
  return settings.itemIds.length > 0 ? 'Configurado, falta sincronizar' : 'Desligado';
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export default function ProfileScreen() {
  const { profile, accounts, transactions, updateProfile, toggleBalances, clearData, work } = useFinance();
  const salaryTotal = work ? computeMonthPay(work, getCurrentMonthKey()).totalCents : 0;
  const { colors, fonts, preference, setPreference } = useAppTheme();
  const router = useRouter();
  const { settings } = useAiSettings();
  const { prefs } = useSecurity();
  const openFinance = useOpenFinanceSettings();
  const update = useAppUpdate();
  const initial = profile.name.trim().charAt(0).toLocaleUpperCase('pt-BR') || 'H';
  const [photoError, setPhotoError] = useState('');

  async function changePhoto() {
    setPhotoError('');
    try {
      const uri = await pickProfilePhoto();
      if (!uri) return;
      const previous = profile.photoUri;
      updateProfile({ photoUri: uri });
      await removeProfilePhoto(previous);
    } catch (error) {
      console.warn('Foto de perfil', error);
      setPhotoError('Não foi possível usar essa foto. Tente outra.');
    }
  }

  async function removePhoto() {
    const previous = profile.photoUri;
    updateProfile({ photoUri: undefined });
    try {
      await removeProfilePhoto(previous);
    } catch (error) {
      console.warn('Remover foto de perfil', error);
    }
  }

  function clearEverything() {
    void removePhoto();
    clearData();
  }

  return (
    <Screen>
      <ScreenHeader title="Perfil" subtitle="O HexFin do seu jeito" showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Card style={styles.profileCard}>
          <View style={styles.photoColumn}>
            <Pressable accessibilityRole="button" accessibilityLabel={profile.photoUri ? 'Trocar foto de perfil' : 'Escolher foto de perfil'} onPress={changePhoto} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <ProfileAvatar initial={initial} photoUri={profile.photoUri} />
              <View style={[styles.cameraBadge, { backgroundColor: colors.text, borderColor: colors.surface }]}>
                <Ionicons name="camera" size={12} color={colors.background} />
              </View>
            </Pressable>
            {profile.photoUri ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Remover foto de perfil" onPress={removePhoto} hitSlop={8} style={styles.removePhoto}>
                <Text style={[styles.removePhotoText, { color: colors.textMuted, fontFamily: fonts.medium }]}>Remover</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.profileTextContainer}>
            <TextInput
              accessibilityLabel="Seu nome"
              value={profile.name}
              onChangeText={(name) => updateProfile({ name })}
              placeholder="Como podemos chamar você?"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              maxLength={40}
              style={[styles.nameInput, { color: colors.text, fontFamily: fonts.semiBold }]}
            />
            <Text style={[styles.profileCaption, { color: photoError ? colors.expense : colors.textMuted, fontFamily: fonts.regular }]}>
              {photoError || 'Toque na foto para trocar. Ela fica só no seu celular.'}
            </Text>
          </View>
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Preferências" />
          <Card style={styles.listCard}>
            <ListRow
              icon="eye-off-outline"
              title="Ocultar valores"
              subtitle="Esconde os valores em todas as telas"
              bordered
              right={
                <Toggle
                  accessibilityLabel="Ocultar valores"
                  value={profile.hideBalances}
                  onValueChange={toggleBalances}
                />
              }
            />
            <View style={styles.themeSection}>
              <Text style={[styles.themeTitle, { color: colors.text, fontFamily: fonts.medium }]}>Aparência</Text>
              <View style={styles.themeOptions}>
                {themeOptions.map((option) => {
                  const active = preference === option.id;
                  return (
                    <Button
                      key={option.id}
                      label={option.label}
                      icon={option.icon}
                      variant={active ? 'primary' : 'secondary'}
                      onPress={() => setPreference(option.id)}
                      style={styles.themeButton}
                    />
                  );
                })}
              </View>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Assistentes" />
          <Card style={styles.listCard}>
            {ASSISTANTS.map((assistant, index) => {
              const enabled = isAssistantEnabled(profile.disabledAssistants, assistant.id);
              return (
                <ListRow
                  key={assistant.id}
                  icon={assistant.icon as IconName}
                  title={assistant.name}
                  subtitle={assistant.watches}
                  bordered={index < ASSISTANTS.length - 1}
                  right={
                    <Toggle
                      accessibilityLabel={`${enabled ? 'Desligar' : 'Ligar'} ${assistant.name}`}
                      value={enabled}
                      onValueChange={() => updateProfile({ disabledAssistants: toggleAssistant(profile.disabledAssistants, assistant.id) })}
                    />
                  }
                />
              );
            })}
          </Card>
          <Text style={[styles.sectionHint, { color: colors.textMuted, fontFamily: fonts.regular }]}>
            Os ligados aparecem na aba Assistentes e no Início.
          </Text>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Trabalho" />
          <Card style={styles.listCard}>
            <ListRow
              icon="time-outline"
              title="Salário por hora"
              subtitle={salaryTotal > 0 ? `${formatCurrency(salaryTotal)} previsto neste mês` : 'Escala, faltas, feriados e quinzenas'}
              onPress={() => router.push('/salary')}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Segurança" />
          <Card style={styles.listCard}>
            <ListRow
              icon="shield-checkmark-outline"
              title="Bloqueio com PIN"
              subtitle={prefs.pinEnabled ? 'Ativado' : 'Desativado'}
              onPress={() => router.push('/security')}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Inteligência artificial" />
          <Card style={styles.listCard}>
            <ListRow
              icon="sparkles-outline"
              title="Sugestões com IA"
              subtitle={AI_MODE_LABELS[settings.mode]}
              onPress={() => router.push('/ai/settings')}
            />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Seus dados" />
          <Card style={styles.listCard}>
            <ListRow
              icon="git-network-outline"
              title="Open Finance"
              subtitle={openFinanceStatus(openFinance.settings)}
              onPress={() => router.push('/open-finance')}
              bordered
            />
            <ListRow
              icon="wallet-outline"
              title="Minhas contas"
              subtitle={`${plural(accounts.length, 'conta', 'contas')} · ${plural(transactions.length, 'atividade', 'atividades')}`}
              onPress={() => router.push('/accounts')}
              bordered
            />
            <ListRow
              icon="trash-outline"
              title="Apagar contas e transações"
              destructive
              onPress={() => confirmAction('Apagar todos os dados?', 'Esta ação remove permanentemente suas contas e transações deste dispositivo.', 'Apagar tudo', clearEverything)}
            />
          </Card>
          <View style={styles.privacyNote}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.privacyText, { color: colors.textMuted, fontFamily: fonts.regular }]}>
              Tudo fica só neste aparelho. Com a IA ligada, apenas a descrição das transações é enviada para sugerir categorias. Com o Open Finance, o app só lê seus dados no Pluggy. Para saber se há versão nova, o app só consulta a página pública do HexFin no GitHub, sem enviar nada. Desinstalar o app ou limpar os dados apaga os registros.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Sobre o app" />
          <Card style={styles.listCard}>
            <ListRow
              icon="cloud-download-outline"
              title="Procurar atualização"
              subtitle={updateStatus(update.state)}
              onPress={update.state.status === 'checking' ? undefined : () => update.check()}
            />
          </Card>
        </View>

        <Text style={[styles.version, { color: colors.textMuted, fontFamily: fonts.regular }]}>HexFin {CURRENT_VERSION} · feito para sua independência financeira</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoColumn: { alignItems: 'center' },
  cameraBadge: { position: 'absolute', right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  removePhoto: { marginTop: 6, minHeight: 24, justifyContent: 'center' },
  removePhotoText: { fontSize: 11 },
  profileTextContainer: { flex: 1 },
  nameInput: { minWidth: 0, fontSize: 20, paddingVertical: 3, outlineStyle: 'none' } as never,
  profileCaption: { fontSize: 11, marginTop: 6 },
  section: { marginTop: 28 },
  listCard: { paddingVertical: 4, paddingHorizontal: 16 },
  themeSection: { paddingTop: 14, paddingBottom: 14 },
  themeTitle: { fontSize: 14 },
  themeOptions: { flexDirection: 'row', gap: 7, marginTop: 12 },
  themeButton: { flex: 1, minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 14 },
  sectionHint: { fontSize: 11, lineHeight: 17, marginTop: 10, paddingHorizontal: 4 },
  privacyNote: { flexDirection: 'row', gap: 8, marginTop: 12, paddingHorizontal: 4 },
  privacyText: { flex: 1, fontSize: 11, lineHeight: 17 },
  version: { fontSize: 10, textAlign: 'center', marginTop: 30 },
});
