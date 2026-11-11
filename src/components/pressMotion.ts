/** Toque com leve encolhida: curto, e sem movimento quando o aparelho pede para reduzir. */
export const PRESS_SCALE = 0.97;
export const PRESS_MS = 150;
export const FOLD_MS = 200;

export function pressScale(pressed: boolean, reduceMotion: boolean): number {
  return pressed && !reduceMotion ? PRESS_SCALE : 1;
}

/** Duração da animação; zero quando o movimento está reduzido. */
export function motionMs(durationMs: number, reduceMotion: boolean): number {
  return reduceMotion ? 0 : durationMs;
}

/** Giro da seta de seção: 0° fechada, 180° aberta. */
export function foldRotation(open: boolean): number {
  return open ? 180 : 0;
}
