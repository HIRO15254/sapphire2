import { useState } from "react";

export interface UseCurrencyCardV2Result {
	confirmingDelete: boolean;
	handleCancelDelete: () => void;
	handleConfirmDelete: (onDelete: () => void) => void;
	handleStartDelete: () => void;
	handleToggleExpanded: () => void;
}

interface UseCurrencyCardV2Args {
	isExpanded: boolean;
	onExpandChange?: (expanded: boolean) => void;
}

export function useCurrencyCardV2({
	isExpanded,
	onExpandChange,
}: UseCurrencyCardV2Args): UseCurrencyCardV2Result {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	const handleStartDelete = () => {
		setConfirmingDelete(true);
	};

	const handleCancelDelete = () => {
		setConfirmingDelete(false);
	};

	const handleConfirmDelete = (onDelete: () => void) => {
		onDelete();
		setConfirmingDelete(false);
	};

	const handleToggleExpanded = () => {
		const next = !isExpanded;
		if (!next) {
			setConfirmingDelete(false);
		}
		onExpandChange?.(next);
	};

	return {
		confirmingDelete,
		handleCancelDelete,
		handleConfirmDelete,
		handleStartDelete,
		handleToggleExpanded,
	};
}
