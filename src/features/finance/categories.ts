import type { Category } from './types';

export const CATEGORIES: Category[] = [
  { id: 'housing', name: 'Moradia', icon: 'home-outline', color: '#8B5CF6', type: 'expense' },
  { id: 'food', name: 'Alimentação', icon: 'restaurant-outline', color: '#F59E0B', type: 'expense' },
  { id: 'transport', name: 'Transporte', icon: 'car-outline', color: '#38BDF8', type: 'expense' },
  { id: 'leisure', name: 'Lazer', icon: 'game-controller-outline', color: '#EC4899', type: 'expense' },
  { id: 'health', name: 'Saúde', icon: 'medkit-outline', color: '#FB7185', type: 'expense' },
  { id: 'shopping', name: 'Compras', icon: 'bag-handle-outline', color: '#F97316', type: 'expense' },
  { id: 'subscriptions', name: 'Assinaturas', icon: 'refresh-outline', color: '#A3E635', type: 'expense' },
  { id: 'education', name: 'Educação', icon: 'school-outline', color: '#818CF8', type: 'expense' },
  { id: 'salary', name: 'Salário', icon: 'briefcase-outline', color: '#8B7CFF', type: 'income' },
  { id: 'investments', name: 'Investimentos', icon: 'trending-up-outline', color: '#34D399', type: 'both' },
  { id: 'other', name: 'Outros', icon: 'ellipsis-horizontal-outline', color: '#A1A1AA', type: 'both' },
];

export function getCategory(id: string): Category {
  return CATEGORIES.find((category) => category.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!;
}

export function categoriesForType(type: 'income' | 'expense'): Category[] {
  return CATEGORIES.filter((category) => category.type === type || category.type === 'both');
}
