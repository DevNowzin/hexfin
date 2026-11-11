import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Toggle } from '@/components/Toggle';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { PinFlow } from '@/features/security/components/PinFlow';
import { AUTO_LOCK_OPTIONS, type AutoLockSeconds } from '@/features/security/pin';
import { useSecurity } from '@/features/security/SecurityContext';
import { useAppTheme } from '@/theme/AppTheme';

type Flow = null | 'enable' | 'disable' | 'change-verify' | 'change-new';

const AUTO_LOCK_LABELS: Record<AutoLockSeconds, string> = { 0: 'Na hora', 60: '1 min', 300: '5 min' };

export default function SecurityScreen() {
  const { colors, fonts } = useAppTheme();
  const { prefs, verifyPin, enablePin, disablePin, setAutoLock } = useSecurity();
  const [flow, setFlow] = useState<Flow>(null);
  const [message, setMessage] = useState('');

  function done(text: string) {
    setFlow(null);
    setMessage(text);
  }

  async function run(action: () => Promise<void>, success: string) {
    try {
      await action();
      done(success);
    } catch {
      done('Não foi possível salvar neste aparelho. Tente de novo.');
    }
  }

  if (flow) {
    const cancel = <Button label="Cancelar" variant="ghost" onPress={() => setFlow(null)} />;
    return (
      <Screen>
        <ScreenHeader title="Segurança" showBack />
        <View style={styles.flow}>
          {flow === 'enable' || flow === 'change-new' ? (
            <PinFlow
              mode="create"
              onDone={(pin) => run(() => enablePin(pin), flow === 'enable' ? 'PIN ativado.' : 'PIN trocado.')}
              footer={cancel}
            />
          ) : (
            <PinFlow
              mode="verify"
              title="Digite o PIN atual"
              verify={verifyPin}
              onDone={() => (flow === 'disable' ? void run(disablePin, 'PIN desativado.') : setFlow('change-new'))}
              footer={cancel}
            />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Segurança" subtitle="Proteção do app neste celular" showBack />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name="keypad-outline" size={20} color={colors.text} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text, fontFamily: fonts.medium }]}>Bloqueio com PIN</Text>
              <Text style={[styles.rowDescription, { color: colors.textMuted, fontFamily: fonts.regular }]}>Pede o PIN ao abrir o app</Text>
            </View>
            <Toggle
              accessibilityLabel="Bloqueio com PIN"
              value={prefs.pinEnabled}
              onValueChange={(on) => setFlow(on ? 'enable' : 'disable')}
            />
          </View>
          {prefs.pinEnabled ? (
            <Button label="Trocar PIN" icon="refresh-outline" variant="secondary" onPress={() => setFlow('change-verify')} style={styles.changeButton} />
          ) : null}
        </Card>

        {prefs.pinEnabled ? (
          <View style={styles.section}>
            <SectionHeader title="Bloquear depois de sair do app" />
            <View style={styles.options}>
              {AUTO_LOCK_OPTIONS.map((seconds) => (
                <Button
                  key={seconds}
                  label={AUTO_LOCK_LABELS[seconds]}
                  variant={prefs.autoLockSeconds === seconds ? 'primary' : 'secondary'}
                  onPress={() => void run(() => setAutoLock(seconds), 'Tempo de bloqueio salvo.')}
                  style={styles.option}
                />
              ))}
            </View>
          </View>
        ) : null}

        {message ? <Text style={[styles.message, { color: colors.income, fontFamily: fonts.medium }]}>{message}</Text> : null}

        <Card style={styles.section}>
          <View style={styles.row}>
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.note, { color: colors.textMuted, fontFamily: fonts.regular }]}>
              O PIN fica guardado criptografado só neste celular. Como não há servidor, ele não pode ser recuperado: se esquecer, o único jeito de entrar é apagar os dados do app. Desbloqueio com a digital chega numa próxima versão.
            </Text>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 42 },
  flow: { flex: 1, justifyContent: 'center', paddingBottom: 40 },
  card: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14 },
  rowDescription: { fontSize: 11, marginTop: 4 },
  changeButton: { marginTop: 16 },
  section: { marginTop: 24 },
  options: { flexDirection: 'row', gap: 7 },
  option: { flex: 1, minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, borderRadius: 14 },
  message: { fontSize: 13, marginTop: 18 },
  note: { flex: 1, fontSize: 12, lineHeight: 18 },
});
