import { useState } from "react";
import {
	buildGroupFormatter,
	getAmountDisplay,
	getDateDisplay,
	type TransactionDisplayItem,
} from "@/features/currencies/utils/transaction-list-helpers";

export interface UseTransactionListV2Result {
	confirmingDeleteId: string | null;
	expandedId: string | null;
	getAmountClass: (amount: number) => string;
	getAmountDisplay: (amount: number) => string;
	getDateDisplay: (transactedAt: Date | string) => string;
	onCollapse: () => void;
	onConfirmDelete: (id: string) => void;
	onConfirmDeleteCancel: () => void;
	onExpand: (id: string) => void;
}

/**
 * v2 uses semantic success/destructive tokens (from theme-v2 scope) instead of
 * the hard-coded green-600 / red-600 from the legacy palette.
 */
function getAmountClassV2(amount: number): string {
	return amount >= 0 ? "text-[hsl(var(--success))]" : "text-destructive";
}

export function useTransactionListV2(
	transactions: TransactionDisplayItem[]
): UseTransactionListV2Result {
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
		null
	);

	const fmt = buildGroupFormatter(transactions);

	const onExpand = (id: string) => {
		setExpandedId(id);
		setConfirmingDeleteId(null);
	};

	const onCollapse = () => {
		setExpandedId(null);
		setConfirmingDeleteId(null);
	};

	const onConfirmDelete = (id: string) => {
		setConfirmingDeleteId(id);
	};

	const onConfirmDeleteCancel = () => {
		setConfirmingDeleteId(null);
	};

	return {
		confirmingDeleteId,
		expandedId,
		getAmountClass: getAmountClassV2,
		getAmountDisplay: (amount: number) => getAmountDisplay(amount, fmt),
		getDateDisplay,
		onCollapse,
		onConfirmDelete,
		onConfirmDeleteCancel,
		onExpand,
	};
}
