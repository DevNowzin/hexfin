import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { AI_ERROR_MESSAGES } from '@/services/ai';
import { useAppTheme } from '@/theme/AppTheme';
import type { InsightsRequest } from '../types';
import { useAiInsights } from '../useAiInsights';

/** Comentário da IA sobre o mês. Só aparece com o consentimento próprio; sem ele a tela segue só com os assistentes locais. */
export function AiInsightsCard({ request }: { request: InsightsRequest | null }) {
  const { colors, fonts } = useAppTheme();
  const { available, status, insights, error, run } = useAiInsights(request);
  if (!available) return null;

  const toneColor = { positive: colors.income, warning: colors.expense, neutral: colors.text } as const;
  const muted = [styles.muted, { color: colors.textMuted, fontFamily: fonts.regular }];

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={20} color={colors.primary} />
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]}>Comentário da IA</Text>
          <Text style={muted}>Só percentuais saem do aparelho</Text>
        </View>
      </View>

      {status === 'done' ? (
        <View style={styles.list}>
          {insights.map((insight, index) => (
            <View key={`${index}-${insight.title}`} style={[styles.item, { borderTopColor: colors.border }]}>
              <Text style={[styles.itemTitle, { color: toneColor[insight.tone], fontFamily: fonts.semiBold }]}>{insight.title}</Text>
              <Text style={muted}>{insight.message}</Text>
            </View>
          ))}
          <Text style={[muted, styles.caption]}>Escrito pela IA a partir dos percentuais do app. Os números são do app; confira antes de agir.</Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <Text style={[muted, styles.error]}>
          {AI_ERROR_MESSAGES[error ?? 'server']} Os assistentes locais abaixo continuam valendo.
        </Text>
      ) : null}

      {status !== 'done' ? (
        <Button
          label={status === 'error' ? 'Tentar de novo' : 'Pedir comentário da IA'}
          icon="sparkles-outline"
          variant="secondary"
          loading={status === 'loading'}
          onPress={run}
          style={styles.button}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 14, padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 15 },
  muted: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  list: { marginTop: 6 },
  item: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 12 },
  itemTitle: { fontSize: 14 },
  caption: { marginTop: 12, fontSize: 11 },
  error: { marginTop: 12 },
  button: { marginTop: 14 },
});
