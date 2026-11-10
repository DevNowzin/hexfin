export interface AppColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryText: string;
  /** Texto sobre fundos coloridos (selo da instituição, botão de perigo). */
  onColor: string;
  /** Segundo tom do brilho do Início, ao lado do `primary`. */
  glow: string;
  income: string;
  expense: string;
  warning: string;
  overlay: string;
  tabBar: string;
}

export const darkColors: AppColors = {
  background: '#09090B',
  surface: '#18181B',
  surfaceElevated: '#232327',
  text: '#FAFAFA',
  textMuted: '#A1A1AA',
  border: '#27272A',
  // Roxo azulado: cor de destaque do HexFin.
  primary: '#8B7CFF',
  primaryText: '#FFFFFF',
  onColor: '#FFFFFF',
  glow: '#3B82F6',
  income: '#4ADE80',
  expense: '#FB7185',
  warning: '#FBBF24',
  overlay: 'rgba(0, 0, 0, 0.72)',
  tabBar: '#111113',
};

export const lightColors: AppColors = {
  background: '#F4F4F2',
  surface: '#FFFFFF',
  surfaceElevated: '#EAEAE7',
  text: '#18181B',
  textMuted: '#71717A',
  border: '#E4E4E1',
  primary: '#5B4BDB',
  primaryText: '#FFFFFF',
  onColor: '#FFFFFF',
  glow: '#3B82F6',
  income: '#15803D',
  expense: '#E11D48',
  warning: '#B45309',
  overlay: 'rgba(24, 24, 27, 0.42)',
  tabBar: '#FFFFFF',
};

export const fonts = {
  regular: 'Geist_400Regular',
  medium: 'Geist_500Medium',
  semiBold: 'Geist_600SemiBold',
  bold: 'Geist_700Bold',
} as const;

/** Cores fixas da marca: abertura e carregamento (iguais em claro e escuro, como a abertura nativa). */
export const brandColors = {
  splashBackground: '#09090B',
  lilac: '#C798FF',
} as const;
