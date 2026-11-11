import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAppTheme } from '@/theme/AppTheme';
import { FOLD_MS, foldRotation, motionMs } from './pressMotion';

/** Seta de seção que gira meia volta ao abrir. */
export function FoldChevron({ open }: { open: boolean }) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const rotation = useSharedValue(foldRotation(open));
  useEffect(() => {
    rotation.value = withTiming(foldRotation(open), { duration: motionMs(FOLD_MS, reduceMotion) });
  }, [open, reduceMotion, rotation]);
  const animated = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View style={animated}>
      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
    </Animated.View>
  );
}
