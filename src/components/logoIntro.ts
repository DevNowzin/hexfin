// Montagem da raposa (proposta A do Claude Design): cada peça chega de um lado, em sequência.
// Coordenadas no quadro do SVG (0 a 184), convertidas para o tamanho da tela por `toBox`.

export const LOGO_VIEWBOX = 184;

export type LogoLayer = 'hexTop' | 'hexLeft' | 'band' | 'tail' | 'ear';

export interface IntroStep {
  layer: LogoLayer;
  delayMs: number;
  durationMs: number;
  /** De onde a peça sai (vai até a posição normal). */
  from: { translateX?: number; translateY?: number; scale?: number; rotateDeg?: number };
  /** Ponto fixo da escala e do giro, no quadro do SVG. Sem ele, o centro. */
  origin?: { x: number; y: number };
  /** A orelha passa um pouco do ponto e volta (pulinho). */
  springy?: boolean;
}

/** Ordem de desenho é a do SVG; a ordem aqui é a de entrada. */
export const INTRO_STEPS: IntroStep[] = [
  { layer: 'hexTop', delayMs: 50, durationMs: 700, from: { translateX: 16, translateY: -16 } },
  { layer: 'hexLeft', delayMs: 150, durationMs: 700, from: { translateX: -18 } },
  { layer: 'band', delayMs: 250, durationMs: 700, from: { translateY: 18 } },
  { layer: 'tail', delayMs: 450, durationMs: 700, from: { scale: 0.55, rotateDeg: -14 }, origin: { x: 64, y: 162 } },
  { layer: 'ear', delayMs: 700, durationMs: 550, from: { translateY: 12, scale: 0.5 }, origin: { x: 98, y: 62 }, springy: true },
];

/** Quando a última peça termina de chegar. */
export function introDurationMs(steps: IntroStep[] = INTRO_STEPS): number {
  return steps.reduce((longest, step) => Math.max(longest, step.delayMs + step.durationMs), 0);
}

/** Converte uma medida do quadro do SVG para pixels de uma caixa de `size`. */
export function toBox(value: number, size: number): number {
  return (value * size) / LOGO_VIEWBOX;
}
