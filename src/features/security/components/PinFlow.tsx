import { useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';
import { PIN_LENGTH, pinWeakness } from '../pin';
import type { VerifyResult } from '../SecurityContext';
import { PinPad } from './PinPad';

type PinFlowProps =
  | { mode: 'create'; onDone: (pin: string) => void | Promise<void>; footer?: ReactNode }
  | { mode: 'verify'; title?: string; verify: (pin: string) => Promise<VerifyResult>; onDone: () => void; footer?: ReactNode };

export function describeFailure(result: Exclude<VerifyResult, { ok: true }>): string {
  if (result.waitMs > 0) return `Muitas tentativas. Tente de novo em ${Math.ceil(result.waitMs / 1000)} s.`;
  if (result.reason === 'wrong') return `PIN incorreto. ${result.attemptsLeft} tentativa${result.attemptsLeft === 1 ? '' : 's'} antes da espera.`;
  return 'Aguarde para tentar de novo.';
}

/** Criar PIN (digitar + confirmar) ou verificar o PIN atual, com as mensagens de erro. */
export function PinFlow(props: PinFlowProps) {
  const { colors, fonts } = useAppTheme();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleComplete(pin: string) {
    setBusy(true);
    try {
      if (props.mode === 'verify') {
        const result = await props.verify(pin);
        if (result.ok) return props.onDone();
        setMessage(describeFailure(result));
        setValue('');
        return;
      }
      if (step === 'enter') {
        const weakness = pinWeakness(pin);
        if (weakness) {
          setMessage(weakness);
          setValue('');
          return;
        }
        setFirst(pin);
        setStep('confirm');
        setMessage('');
        setValue('');
        return;
      }
      if (pin !== first) {
        setMessage('Os PINs não são iguais. Comece de novo.');
        setStep('enter');
        setFirst('');
        setValue('');
        return;
      }
      await props.onDone(pin);
    } catch {
      setMessage('Não foi possível salvar o PIN neste aparelho. Tente de novo.');
      setValue('');
    } finally {
      setBusy(false);
    }
  }

  const title =
    props.mode === 'verify' ? (props.title ?? 'Digite seu PIN') : step === 'enter' ? `Crie um PIN de ${PIN_LENGTH} dígitos` : 'Repita o PIN';

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>{title}</Text>
      <Text style={[styles.message, { color: message ? colors.expense : colors.textMuted, fontFamily: fonts.regular }]}>
        {message || (props.mode === 'create' && step === 'enter' ? 'Ele protege o app neste celular.' : ' ')}
      </Text>
      <PinPad
        value={value}
        onChange={(next) => {
          setValue(next);
          if (next) setMessage('');
          if (next.length === PIN_LENGTH && !busy) void handleComplete(next);
        }}
        disabled={busy}
        error={Boolean(message)}
      />
      {props.footer ? <View style={styles.footer}>{props.footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  title: { fontSize: 22, textAlign: 'center' },
  message: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 8, marginBottom: 32, minHeight: 38, paddingHorizontal: 24 },
  footer: { marginTop: 24, alignItems: 'center' },
});
