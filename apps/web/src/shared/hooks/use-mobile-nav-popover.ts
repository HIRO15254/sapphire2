import { useState } from "react";

interface UseMobileNavPopoverResult {
	isOpen: boolean;
	onClose: () => void;
	onOpenChange: (open: boolean) => void;
}

export function useMobileNavPopover(): UseMobileNavPopoverResult {
	const [isOpen, setIsOpen] = useState(false);

	return {
		isOpen,
		onClose: () => setIsOpen(false),
		onOpenChange: setIsOpen,
	};
}
