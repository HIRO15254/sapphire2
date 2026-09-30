import { useState } from "react";

interface UseDiscardConfirmOptions {
	isDirty: () => boolean;
	onOpenChange: (open: boolean) => void;
}

export function useDiscardConfirm({
	isDirty,
	onOpenChange,
}: UseDiscardConfirmOptions) {
	const [isConfirmOpen, setIsConfirmOpen] = useState(false);

	const onRequestClose = (open: boolean) => {
		if (open || !isDirty()) {
			onOpenChange(open);
			return;
		}
		setIsConfirmOpen(true);
	};

	const onConfirmDiscard = () => {
		setIsConfirmOpen(false);
		onOpenChange(false);
	};

	const onCancelDiscard = () => {
		setIsConfirmOpen(false);
	};

	return {
		isConfirmOpen,
		onCancelDiscard,
		onConfirmDiscard,
		onRequestClose,
	};
}
