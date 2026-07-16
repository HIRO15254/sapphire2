export interface ItemTransaction {
	count: number;
	createdAt?: Date | string;
	id: string;
	itemId?: string;
	memo?: string | null;
	sessionId?: string | null;
	sessionName?: string | null;
	transactedAt: Date | string;
}
