import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HexLogo } from '@/components/HexLogo';
import { useAiSettings } from '@/features/ai/AiSettingsContext';
import { useFinance } from '@/features/finance/FinanceContext';
import { useAppTheme } from '@/theme/AppTheme';
import { confirmAction } from '@/utils/confirm';
import { PinFlow } from './components/PinFlow';
import { useSecurity } from './SecurityContext';

/** Cobre o app inteiro enquanto estiver bloqueado; a navegação por baixo é preservada. */
export function LockScreen() {
  const { colors, fonts } = useAppTheme();
  const { unlock, forgetAll } = useSecurity();
  const { clearData, updateProfile } = useFinance();
  const { reset: resetAi } = useAiSettings();

  function forgotPin() {
    confirmAction(
      'Esqueceu o PIN?',
      'Sem servidor, não há como recuperar o PIN. O único jeito de entrar é apagar contas, transações e chaves deste celular e começar de novo.',
      'Apagar e recomeçar',
      () => {
        clearData();
        updateProfile({ name: '', hideBalances: false });
        Promise.all([resetAi(), forgetAll()]).catch((error: unknown) => {
          console.warn('[security] falha ao apagar dados locais', error instanceof Error ? error.name : 'unknown');
        });
      },
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: colors.background }]} accessibilityViewIsModal>
      <HexLogo compact size={48} />
      <View style={styles.flow}>
        <PinFlow
          mode="verify"
          verify={unlock}
          onDone={() => undefined}
          footer={
            <Pressable accessibilityRole="button" onPress={forgotPin} hitSlop={10}>
              <Text style={[styles.forgot, { color: colors.textMuted, fontFamily: fonts.medium }]}>Esqueci o PIN</Text>
            </Pressable>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingTop: 40, zIndex: 100 },
  flow: { marginTop: 36 },
  forgot: { fontSize: 14 },
});
