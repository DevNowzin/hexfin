import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { HexLogo } from '@/components/HexLogo';
import { IconButton } from '@/components/IconButton';
import { Screen } from '@/components/Screen';
import { useFinance } from '@/features/finance/FinanceContext';
import { useAppTheme } from '@/theme/AppTheme';
import { PinFlow } from './components/PinFlow';
import { useSecurity } from './SecurityContext';

type Step = 'intro' | 'name' | 'pin';
const STEPS: Step[] = ['intro', 'name', 'pin'];
const PREVIOUS: Record<Step, Step | null> = { intro: null, name: 'intro', pin: 'name' };

/** Primeira abertura: apresentação, nome e PIN. Sem cadastro: tudo fica no aparelho. */
export function Onboarding() {
  const { colors, fonts } = useAppTheme();
  const { profile, updateProfile } = useFinance();
  const { completeOnboarding } = useSecurity();
  const [step, setStep] = useState<Step>('intro');
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState('');
  const previous = PREVIOUS[step];
  const stepNumber = STEPS.indexOf(step) + 1;

  // Voltar do Android volta um passo em vez de fechar o app.
  useEffect(() => {
    if (!previous) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setStep(previous);
      return true;
    });
    return () => subscription.remove();
  }, [previous]);

  async function finish(pin: string | null) {
    try {
      await completeOnboarding(pin);
    } catch {
      setError('Não foi possível salvar neste aparelho. Tente de novo.');
    }
  }

  return (
    <Screen>
      <View
        style={styles.progress}
        accessibilityRole="progressbar"
        accessibilityLabel={`Passo ${stepNumber} de ${STEPS.length}`}
        accessibilityValue={{ min: 1, max: STEPS.length, now: stepNumber }}
      >
        {STEPS.map((item) => (
          <View
            key={item}
            style={[styles.progressBar, { backgroundColor: STEPS.indexOf(item) < stepNumber ? colors.primary : colors.surfaceElevated }]}
          />
        ))}
      </View>

      {previous ? <IconButton icon="arrow-back" label="Voltar" filled onPress={() => setStep(previous)} style={styles.back} /> : null}

      {step === 'intro' ? (
        <View style={styles.body}>
          <View style={styles.cards}>
            <Card style={styles.previewCard}>
              <HexLogo compact size={34} />
              <View>
                <Text style={[styles.previewLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>Saldo em contas</Text>
                <Text style={[styles.previewValue, { color: colors.text, fontFamily: fonts.bold }]}>R$ ••••</Text>
              </View>
            </Card>
            <Card style={styles.previewCard}>
              <Ionicons name="lock-closed" size={28} color={colors.primary} />
              <View>
                <Text style={[styles.previewLabel, { color: colors.textMuted, fontFamily: fonts.regular }]}>Seus dados</Text>
                <Text style={[styles.previewValue, { color: colors.text, fontFamily: fonts.bold }]}>Só aqui</Text>
              </View>
            </Card>
          </View>
          <View style={styles.bottom}>
            <Text style={[styles.hero, { color: colors.text, fontFamily: fonts.semiBold }]}>Suas finanças, só suas</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted, fontFamily: fonts.regular }]}>
              Sem cadastro e sem servidor. Tudo fica neste celular, protegido por um PIN.
            </Text>
            <Button label="Começar" onPress={() => setStep('name')} />
          </View>
        </View>
      ) : null}

      {step === 'name' ? (
        <View style={styles.body}>
          <View>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>Como quer ser chamado?</Text>
            <TextInput
              accessibilityLabel="Seu nome"
              value={name}
              onChangeText={setName}
              placeholder="Seu nome ou apelido"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.primary}
              maxLength={40}
              autoFocus
              style={[styles.input, { color: colors.text, borderColor: colors.border, fontFamily: fonts.regular }]}
            />
          </View>
          <Button
            label="Continuar"
            onPress={() => {
              updateProfile({ name: name.trim() });
              setStep('pin');
            }}
          />
        </View>
      ) : null}

      {step === 'pin' ? (
        <View style={styles.pinBody}>
          <PinFlow
            mode="create"
            onDone={(pin) => finish(pin)}
            footer={
              <Pressable accessibilityRole="button" onPress={() => finish(null)} hitSlop={10}>
                <Text style={[styles.skip, { color: colors.textMuted, fontFamily: fonts.medium }]}>Pular por enquanto</Text>
              </Pressable>
            }
          />
          {error ? <Text style={[styles.error, { color: colors.expense, fontFamily: fonts.medium }]}>{error}</Text> : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  back: { marginLeft: 16, marginTop: 16 },
  body: { flex: 1, justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 28 },
  cards: { flexDirection: 'row', gap: 12, marginTop: 60 },
  previewCard: { flex: 1, height: 170, justifyContent: 'space-between' },
  previewLabel: { fontSize: 12 },
  previewValue: { fontSize: 20, marginTop: 4 },
  bottom: { gap: 18 },
  hero: { fontSize: 44, lineHeight: 50, letterSpacing: -1.5 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 10 },
  title: { fontSize: 28, letterSpacing: -0.8 },
  input: { marginTop: 22, minHeight: 56, borderRadius: 18, borderWidth: 1, paddingHorizontal: 18, fontSize: 16, outlineStyle: 'none' } as never,
  pinBody: { flex: 1, justifyContent: 'center', paddingBottom: 24 },
  skip: { fontSize: 14 },
  error: { fontSize: 13, textAlign: 'center', marginTop: 16 },
});
