import type { WorkSettings } from '@/features/work/payroll';

export type TransactionType = 'income' | 'expense';
export type TransactionStatus = 'completed' | 'pending';
export type Recurrence = 'weekly' | 'monthly' | 'yearly';
/** `credit` e `loan` são dívidas: saldo negativo e fora do "saldo em contas". Só vêm do Open Finance. */
export type AccountType = 'checking' | 'savings' | 'investment' | 'cash' | 'credit' | 'loan';
export type ThemePreference = 'system' | 'light' | 'dark';
export type AssistantId =
  | 'savings-rate'
  | 'month-comparison'
  | 'top-category'
  | 'recurring'
  | 'weekly-summary'
  | 'duplicate-charges';

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  color: string;
  openingBalanceCents: number;
  /** Id de origem quando a conta veio do Open Finance (ex.: `pluggy:<id>`). Saldo e tipo vêm do banco. */
  externalId?: string;
  /** Cartão do Open Finance: fechamento e vencimento da fatura aberta (`YYYY-MM-DD`), base do ciclo de cada mês. */
  billCycle?: { closeDate: string; dueDate: string };
}

export interface Transaction {
  id: string;
  description: string;
  amountCents: number;
  type: TransactionType;
  date: string;
  categoryId: string;
  accountId: string;
  transferAccountId?: string;
  status: TransactionStatus;
  recurrence?: Recurrence;
  notes?: string;
  createdAt: string;
  /** Id de origem quando a transação veio do Open Finance (ex.: `pluggy:<id>`). */
  externalId?: string;
  /** Pagamento de fatura do cartão: move dinheiro para o cartão e não conta como gasto do mês. */
  billPayment?: boolean;
  /** Compra de cartão do Open Finance: mês (`YYYY-MM`) da fatura em que ela vence. Conta nesse mês, não no da data. */
  billMonth?: string;
}

/** Conta fixa (sem fim) ou empréstimo/parcelado (com parcelas que faltam), cadastrados à mão. */
export type PlannedBillKind = 'fixed' | 'loan';

/**
 * Conta prevista cadastrada à mão (quando o Open Finance não traz). Só prevê: aparece em Recorrentes,
 * mas não mexe em saldo nem em gastos; o pagamento continua sendo uma transação.
 */
export interface PlannedBill {
  id: string;
  description: string;
  amountCents: number;
  /** Dia do vencimento (1 a 31); em mês curto vale o último dia. */
  dueDay: number;
  categoryId: string;
  /** Onde é cobrada; sem conta ("Eu pago": boleto, Pix à mão), fica do lado Conta. */
  accountId?: string;
  kind: PlannedBillKind;
  /** Mês (`YYYY-MM`) do primeiro vencimento contado. */
  startMonth: string;
  /** Empréstimo: quantas parcelas a partir de `startMonth`. */
  installments?: number;
  createdAt: string;
  /** Meses (`YYYY-MM`) que o usuário confirmou como pagos. Vencer não quita sozinho. */
  paidMonths?: string[];
  /** Meses vencidos em que o usuário disse "Ainda não": seguem a pagar, marcados como atrasados. */
  unpaidMonths?: string[];
}

export type PlannedBillDraft = Omit<PlannedBill, 'id' | 'createdAt' | 'paidMonths' | 'unpaidMonths'>;

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionType | 'both';
}

export interface Profile {
  name: string;
  hideBalances: boolean;
  theme: ThemePreference;
  /** Assistentes que o usuário desligou. Ausente = todos ligados. */
  disabledAssistants?: AssistantId[];
}

export interface FinanceData {
  accounts: Account[];
  transactions: Transaction[];
  profile: Profile;
  /** Contas fixas e empréstimos cadastrados à mão. Ausente nos dados antigos. */
  bills?: PlannedBill[];
  /** Salário por hora (escala, faltas, quinzenas). Ausente até o usuário configurar. */
  work?: WorkSettings;
}

export type TransactionDraft = Omit<Transaction, 'id' | 'createdAt'>;
export type AccountDraft = Omit<Account, 'id'>;

export interface MonthSummary {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  pendingCents: number;
}

export interface CategoryTotal {
  category: Category;
  totalCents: number;
  percentage: number;
  transactionCount: number;
}

export interface CashFlowPoint extends MonthSummary {
  monthKey: string;
  label: string;
}
