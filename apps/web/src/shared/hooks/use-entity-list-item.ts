import { useState } from "react";

interface UseEntityListItemOptions {
	isControlled: boolean;
	onExpandedValueChange?: (value: string | null) => void;
}

interface UseEntityListItemResult {
	confirmingDelete: boolean;
	handleCancelDelete: (event: React.MouseEvent) => void;
	handleConfirmDelete: (event: React.MouseEvent, onDelete: () => void) => void;
	handleExpandedValueChange: (nextValue: string | null) => void;
	handleStartDelete: (event: React.MouseEvent) => void;
	internalExpandedValue: string | null;
}

export function useEntityListItem({
	isControlled,
	onExpandedValueChange,
}: UseEntityListItemOptions): UseEntityListItemResult {
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [internalExpandedValue, setInternalExpandedValue] = useState<
		string | null
	>(null);

	const handleExpandedValueChange = (nextValue: string | null) => {
		if (!isControlled) {
			setInternalExpandedValue(nextValue);
		}
		setConfirmingDelete(false);
		onExpandedValueChange?.(nextValue);
	};

	const handleStartDelete = (event: React.MouseEvent) => {
		event.stopPropagation();
		setConfirmingDelete(true);
	};

	const handleCancelDelete = (event: React.MouseEvent) => {
		event.stopPropagation();
		setConfirmingDelete(false);
	};

	const handleConfirmDelete = (
		event: React.MouseEvent,
		onDelete: () => void
	) => {
		event.stopPropagation();
		onDelete();
		setConfirmingDelete(false);
		if (!isControlled) {
			setInternalExpandedValue(null);
		}
		onExpandedValueChange?.(null);
	};

	return {
		confirmingDelete,
		handleCancelDelete,
		handleConfirmDelete,
		handleExpandedValueChange,
		handleStartDelete,
		internalExpandedValue,
	};
}
