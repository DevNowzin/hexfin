// Open Finance pelo Pluggy (MeuPluggy). Os dados brutos da API são validados e convertidos
// em `OpenFinanceSnapshot` antes de tocar nos dados do app.

export type ImportedAccountKind = 'checking' | 'savings' | 'credit';
export type MoneyDirection = 'in' | 'out';

export interface SnapshotTransaction {
  /** `pluggy:<id>` */
  externalId: string;
  description: string;
  /** Sempre positivo; o sentido está em `direction`. */
  amountCents: number;
  direction: MoneyDirection;
  /** `YYYY-MM-DD` no horário de Brasília. */
  date: string;
  status: 'completed' | 'pending';
  /** Conta corrente pagando a fatura do cartão. */
  billPayment: boolean;
  /** No cartão: crédito que é o pagamento da fatura (o lado da conta corrente já registra). */
  cardPayment: boolean;
  /** Parcela de compra no cartão, quando o banco informa. */
  installment?: { number: number; total: number; purchaseDate?: string };
  /** Cartão: mês (`YYYY-MM`) da fatura em que a compra vence. */
  billMonth?: string;
}

/** Fatura aberta do cartão: fechamento e vencimento (`YYYY-MM-DD`). */
export interface BillCycle {
  closeDate: string;
  dueDate: string;
}

export interface SnapshotAccount {
  externalId: string;
  itemId: string;
  kind: ImportedAccountKind;
  name: string;
  institution: string;
  /** Saldo que o banco informa hoje. No cartão, é a fatura em aberto (positivo = devendo). */
  bankBalanceCents: number;
  /** Só cartão, quando o banco informa fechamento e vencimento. */
  billCycle?: BillCycle;
  transactions: SnapshotTransaction[];
}

export interface SnapshotLoan {
  externalId: string;
  itemId: string;
  name: string;
  institution: string;
  /** Quanto falta para quitar (positivo). */
  outstandingCents: number;
}

export interface OpenFinanceSnapshot {
  /** Transações a partir desta data (`YYYY-MM-DD`) foram buscadas de novo. */
  windowStart: string;
  /** Dia da sincronização: o saldo é ancorado com o que já aconteceu até ele. */
  today: string;
  accounts: SnapshotAccount[];
  loans: SnapshotLoan[];
  /** Avisos para a tela (ex.: empréstimos indisponíveis por esta conexão). */
  warnings: string[];
}

export interface ImportReport {
  accountsAdded: number;
  accountsUpdated: number;
  transactionsAdded: number;
  transactionsUpdated: number;
  transactionsRemoved: number;
}

export interface OpenFinanceCredentials {
  clientId: string;
  clientSecret: string;
}

export interface LastSync extends ImportReport {
  at: string;
  warnings: string[];
}

export interface OpenFinanceSettings extends OpenFinanceCredentials {
  itemIds: string[];
  consentedAt?: string;
  lastSync?: LastSync;
}

export const DEFAULT_OPEN_FINANCE_SETTINGS: OpenFinanceSettings = { clientId: '', clientSecret: '', itemIds: [] };
