import type { PropsWithChildren } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { PRESS_MS, motionMs, pressScale } from './pressMotion';

interface PressableScaleProps extends PropsWithChildren, Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
}

/** Área de toque que encolhe de leve ao pressionar (respeita "reduzir movimento"). */
export function PressableScale({ children, style, onPressIn, onPressOut, ...props }: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animateTo = (pressed: boolean) => {
    scale.value = withTiming(pressScale(pressed, reduceMotion), { duration: motionMs(PRESS_MS, reduceMotion) });
  };
  return (
    <Pressable
      {...props}
      onPressIn={(event) => {
        animateTo(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(false);
        onPressOut?.(event);
      }}
      style={style}
    >
      <Animated.View style={animated}>{children}</Animated.View>
    </Pressable>
  );
}
