import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getCategory } from '@/features/finance/categories';
import { AI_ERROR_MESSAGES } from '@/services/ai';
import { useAppTheme } from '@/theme/AppTheme';
import type { AiErrorCode, SuggestionResult } from '../types';

interface CategorySuggestionCardProps {
  suggestion: SuggestionResult | null;
  error?: AiErrorCode;
  loading: boolean;
  selectedCategoryId: string;
  onApply: (categoryId: string) => void;
}

export function CategorySuggestionCard({ suggestion, error, loading, selectedCategoryId, onApply }: CategorySuggestionCardProps) {
  const { colors, fonts } = useAppTheme();

  if (loading) {
    return (
      <View style={[styles.row, styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.textMuted} />
        <Text style={[styles.muted, { color: colors.textMuted, fontFamily: fonts.regular }]}>Procurando uma categoria…</Text>
      </View>
    );
  }

  if (!suggestion) {
    if (!error) return null;
    return (
      <Text style={[styles.errorText, { color: colors.textMuted, fontFamily: fonts.regular }]}>
        {AI_ERROR_MESSAGES[error]} Escolha a categoria manualmente.
      </Text>
    );
  }

  const category = getCategory(suggestion.categoryId);
  const applied = suggestion.categoryId === selectedCategoryId;
  const sourceLabel = suggestion.source === 'ai' ? `IA · ${Math.round(suggestion.confidence * 100)}%` : 'Regra local';

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: applied ? category.color : colors.border }]}>
      <View style={styles.row}>
        <Ionicons name={suggestion.source === 'ai' ? 'sparkles-outline' : 'list-outline'} size={16} color={category.color} />
        <Text style={[styles.title, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          Sugestão: {category.name}
        </Text>
        <Text style={[styles.badge, { color: colors.textMuted, backgroundColor: colors.surfaceElevated, fontFamily: fonts.medium }]}>{sourceLabel}</Text>
        {applied ? (
          <Ionicons name="checkmark-circle" size={20} color={category.color} accessibilityLabel="Sugestão aplicada" />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Usar categoria ${category.name}`}
            onPress={() => onApply(suggestion.categoryId)}
            style={[styles.apply, { backgroundColor: colors.text }]}
          >
            <Text style={[styles.applyText, { color: colors.background, fontFamily: fonts.semiBold }]}>Usar</Text>
          </Pressable>
        )}
      </View>
      {suggestion.reason ? (
        <Text style={[styles.muted, { color: colors.textMuted, fontFamily: fonts.regular }]} numberOfLines={2}>{suggestion.reason}</Text>
      ) : null}
      {suggestion.fallbackReason ? (
        <Text style={[styles.muted, { color: colors.warning, fontFamily: fonts.regular }]}>{AI_ERROR_MESSAGES[suggestion.fallbackReason]}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 6, marginTop: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 13 },
  badge: { fontSize: 10, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, overflow: 'hidden' },
  apply: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  applyText: { fontSize: 12 },
  muted: { fontSize: 11, lineHeight: 16 },
  errorText: { fontSize: 11, lineHeight: 16, marginTop: 8 },
});
