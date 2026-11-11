import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { useAppTheme } from '@/theme/AppTheme';
import { CONCEPTS_NOTICE, INVESTMENT_CONCEPTS } from './concepts';

/** Carrossel de conceitos básicos na aba Investimentos do Início. */
export function InvestmentConcepts() {
  const { colors, fonts } = useAppTheme();
  return (
    <View style={styles.section}>
      <SectionHeader title="Conceitos básicos" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.list}>
        {INVESTMENT_CONCEPTS.map((concept) => (
          <Card key={concept.id} style={styles.card}>
            <View style={[styles.icon, { backgroundColor: colors.surfaceElevated }]}>
              <Ionicons name={concept.icon} size={22} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>{concept.title}</Text>
            <Text style={[styles.text, { color: colors.textMuted, fontFamily: fonts.regular }]}>{concept.text}</Text>
          </Card>
        ))}
      </ScrollView>
      <Text style={[styles.notice, { color: colors.textMuted, fontFamily: fonts.regular }]}>{CONCEPTS_NOTICE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28 },
  list: { gap: 12, paddingRight: 20 },
  card: { width: 220, gap: 8 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  title: { fontSize: 16 },
  text: { fontSize: 12, lineHeight: 17 },
  notice: { fontSize: 11, marginTop: 10 },
});
