export interface Transaction {
	amount: number;
	createdAt?: Date | string;
	currencyId?: string;
	id: string;
	memo?: string | null;
	sessionId?: string | null;
	sessionName?: string | null;
	transactedAt: Date | string;
	transactionTypeId?: string;
	transactionTypeName: string;
}
