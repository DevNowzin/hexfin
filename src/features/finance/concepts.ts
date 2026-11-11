/** Conceitos básicos da aba Investimentos: texto próprio, educativo, sem indicar onde aplicar. */
export interface InvestmentConcept {
  id: string;
  title: string;
  text: string;
  icon: 'water-outline' | 'trending-up-outline' | 'layers-outline' | 'pricetag-outline' | 'grid-outline' | 'shield-checkmark-outline';
}

export const INVESTMENT_CONCEPTS: InvestmentConcept[] = [
  { id: 'liquidity', title: 'Liquidez', icon: 'water-outline', text: 'Quanto tempo leva para o investimento virar dinheiro na conta, e se dá para resgatar antes sem perder valor.' },
  { id: 'return', title: 'Rentabilidade', icon: 'trending-up-outline', text: 'Quanto o valor aplicado rendeu num período, em porcentagem. O que rendeu no passado não garante o futuro.' },
  { id: 'compound', title: 'Juros compostos', icon: 'layers-outline', text: 'O que rende num mês passa a render também nos seguintes. Com o tempo, o crescimento acelera.' },
  { id: 'inflation', title: 'Inflação', icon: 'pricetag-outline', text: 'A alta geral dos preços. Se o rendimento fica abaixo dela, o mesmo dinheiro compra menos do que antes.' },
  { id: 'diversification', title: 'Diversificação', icon: 'grid-outline', text: 'Dividir o dinheiro entre tipos diferentes de aplicação, para que a perda de um não afete tudo de uma vez.' },
  { id: 'emergency', title: 'Reserva de emergência', icon: 'shield-checkmark-outline', text: 'Dinheiro separado para imprevistos, como uma despesa médica ou um período sem renda.' },
];

export const CONCEPTS_NOTICE = 'Conteúdo educativo. Não é recomendação de investimento.';
