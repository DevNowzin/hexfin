import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '@/theme/AppTheme';
import { useAppUpdate } from './useAppUpdate';

/** Aviso no Início quando há um APK mais novo no GitHub. É o único lugar com o botão de baixar. */
export function UpdateBanner() {
  const { colors, fonts } = useAppTheme();
  const { state } = useAppUpdate(true);
  const [hiddenVersion, setHiddenVersion] = useState<string | null>(null);
  const [openError, setOpenError] = useState(false);

  if (state.status !== 'available' || hiddenVersion === state.release.version) return null;
  const { release } = state;

  function download() {
    setOpenError(false);
    Linking.openURL(release.apkUrl).catch(() => setOpenError(true));
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
      <View style={styles.header}>
        <Ionicons name="arrow-down-circle-outline" size={20} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>Versão {release.version} disponível</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Esconder o aviso de versão nova" hitSlop={10} onPress={() => setHiddenVersion(release.version)}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      {release.notes ? (
        <Text numberOfLines={3} style={[styles.notes, { color: colors.textMuted, fontFamily: fonts.regular }]}>{release.notes}</Text>
      ) : null}
      <Text style={[styles.notes, { color: colors.textMuted, fontFamily: fonts.regular }]}>
        Baixe e instale por cima: seus dados continuam no celular.
      </Text>
      {openError ? (
        <Text style={[styles.notes, { color: colors.expense, fontFamily: fonts.medium }]}>Não deu para abrir o download. Tente de novo.</Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={download}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: colors.primaryText, fontFamily: fonts.semiBold }]}>Baixar versão {release.version}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginTop: 12, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 14 },
  notes: { fontSize: 12, lineHeight: 18 },
  button: { minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonText: { fontSize: 14 },
});
