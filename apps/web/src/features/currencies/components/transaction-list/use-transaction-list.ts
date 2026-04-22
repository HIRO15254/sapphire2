import { useState } from "react";
import {
	buildGroupFormatter,
	getAmountClass,
	getAmountDisplay,
	getDateDisplay,
	type TransactionDisplayItem,
} from "@/features/currencies/utils/transaction-list-helpers";

export interface UseTransactionListResult {
	confirmingDeleteId: string | null;
	expandedId: string | null;
	fmt: (n: number) => string;
	getAmountClass: (amount: number) => string;
	getAmountDisplay: (amount: number) => string;
	getDateDisplay: (transactedAt: Date | string) => string;
	onCollapse: () => void;
	onConfirmDelete: (id: string) => void;
	onConfirmDeleteCancel: () => void;
	onExpand: (id: string) => void;
}

export function useTransactionList(
	transactions: TransactionDisplayItem[]
): UseTransactionListResult {
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
		fmt,
		getAmountClass,
		getAmountDisplay: (amount: number) => getAmountDisplay(amount, fmt),
		getDateDisplay,
		onCollapse,
		onConfirmDelete,
		onConfirmDeleteCancel,
		onExpand,
	};
}
