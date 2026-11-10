import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { brandColors } from '@/theme/colors';
import { INTRO_STEPS, type IntroStep, type LogoLayer, toBox } from './logoIntro';

/** Tamanho da raposa na tela de carregamento. */
export const LOADING_LOGO_SIZE = 160;
const DOT_CYCLE_MS = 1400;
const DOT_RISE = 8;
const FLOAT_MS = 1500;
const FLOAT_RISE = 4;
// No Web não há driver nativo; pedir avisaria no console.
const NATIVE_DRIVER = Platform.OS !== 'web';
const EASE_IN = Easing.bezier(0.2, 0.8, 0.2, 1);
const EASE_SPRING = Easing.bezier(0.3, 1.6, 0.5, 1);

// Peças na ordem de desenho do SVG (assets/brand/logo.svg), uma PNG cada (assets/brand/layers).
const LAYERS: Array<{ id: LogoLayer; source: number }> = [
  { id: 'hexTop', source: require('../../assets/brand/layers/hex-top.png') },
  { id: 'hexLeft', source: require('../../assets/brand/layers/hex-left.png') },
  { id: 'ear', source: require('../../assets/brand/layers/ear.png') },
  { id: 'tail', source: require('../../assets/brand/layers/tail.png') },
  { id: 'band', source: require('../../assets/brand/layers/band.png') },
];

// Tempos da animação "Ritmo" do Figma (assets/brand/loading.svg): cada ponto acende e sobe, um depois do outro.
const DOT_TIMES = [
  [0, 0.1286, 0.2571],
  [0.2286, 0.3571, 0.4857],
  [0.4571, 0.5857, 0.7143],
] as const;

function dotInput([start, peak, end]: readonly [number, number, number]): number[] {
  return start === 0 ? [0, peak, end, 1] : [0, start, peak, end, 1];
}

function dotOutput(start: number, low: number, high: number): number[] {
  return start === 0 ? [low, high, low, low] : [low, low, high, low, low];
}

function stepOf(layer: LogoLayer): IntroStep {
  const step = INTRO_STEPS.find((item) => item.layer === layer);
  if (!step) throw new Error(`Peça sem passo na montagem: ${layer}`);
  return step;
}

function layerStyle(step: IntroStep, progress: Animated.Value) {
  const size = LOADING_LOGO_SIZE;
  const from = (value: number | undefined, rest: number) => progress.interpolate({ inputRange: [0, 1], outputRange: [value ?? rest, rest] });
  const px = (value: number | undefined) => (value === undefined ? undefined : toBox(value, size));
  return {
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' as const }),
    transformOrigin: step.origin ? [toBox(step.origin.x, size), toBox(step.origin.y, size), 0] : undefined,
    transform: [
      { translateX: from(px(step.from.translateX), 0) },
      { translateY: from(px(step.from.translateY), 0) },
      { scale: from(step.from.scale, 1) },
      { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: [`${step.from.rotateDeg ?? 0}deg`, '0deg'] }) },
    ],
  };
}

interface LoadingScreenProps {
  /** Chamado quando a tela já está desenhada (hora de esconder a abertura nativa). */
  onShown?: () => void;
  /** Chamado quando a raposa termina de se montar (ou na hora, com "reduzir movimento"). */
  onIntroDone?: () => void;
}

/** Tela de carregamento: a raposa se monta peça por peça e flutua, com três pontos em ritmo embaixo. */
export function LoadingScreen({ onShown, onIntroDone }: LoadingScreenProps) {
  const progress = useRef(LAYERS.map(() => new Animated.Value(0))).current;
  const float = useRef(new Animated.Value(0)).current;
  const dots = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(onIntroDone);
  doneRef.current = onIntroDone;

  useEffect(() => {
    let active = true;
    const dotLoop = Animated.loop(Animated.timing(dots, { toValue: 1, duration: DOT_CYCLE_MS, easing: Easing.linear, useNativeDriver: NATIVE_DRIVER }));
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: FLOAT_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE_DRIVER }),
        Animated.timing(float, { toValue: 0, duration: FLOAT_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE_DRIVER }),
      ]),
    );
    const intro = Animated.parallel(
      LAYERS.map((layer, index) => {
        const step = stepOf(layer.id);
        return Animated.timing(progress[index]!, {
          toValue: 1,
          delay: step.delayMs,
          duration: step.durationMs,
          easing: step.springy ? EASE_SPRING : EASE_IN,
          useNativeDriver: NATIVE_DRIVER,
        });
      }),
    );

    dotLoop.start();
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (!active) return;
        if (reduceMotion) {
          progress.forEach((value) => value.setValue(1));
          doneRef.current?.();
          return;
        }
        intro.start(({ finished }) => {
          if (!finished || !active) return;
          doneRef.current?.();
          floatLoop.start();
        });
      });

    return () => {
      active = false;
      dotLoop.stop();
      intro.stop();
      floatLoop.stop();
    };
  }, [dots, float, progress]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando o HexFin"
      onLayout={onShown}
      style={[StyleSheet.absoluteFill, styles.container]}
    >
      <Animated.View style={[styles.logo, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -FLOAT_RISE] }) }] }]}>
        {LAYERS.map((layer, index) => (
          <Animated.Image
            key={layer.id}
            source={layer.source}
            accessibilityIgnoresInvertColors
            style={[styles.layer, layerStyle(stepOf(layer.id), progress[index]!)]}
          />
        ))}
      </Animated.View>
      <View style={styles.dots}>
        {DOT_TIMES.map((times, index) => {
          const range = dotInput(times);
          const ease = Easing.inOut(Easing.ease);
          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  opacity: dots.interpolate({ inputRange: range, outputRange: dotOutput(times[0], 0.24, 1), easing: ease }),
                  transform: [{ translateY: dots.interpolate({ inputRange: range, outputRange: dotOutput(times[0], 0, -DOT_RISE), easing: ease }) }],
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: brandColors.splashBackground, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOADING_LOGO_SIZE, height: LOADING_LOGO_SIZE },
  layer: { position: 'absolute', left: 0, top: 0, width: LOADING_LOGO_SIZE, height: LOADING_LOGO_SIZE },
  dots: { position: 'absolute', top: '50%', marginTop: LOADING_LOGO_SIZE / 2 + 28, flexDirection: 'row', gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: brandColors.lilac },
});
