import { useState } from "react";

export function useHistorySection() {
	const [isOpen, setIsOpen] = useState(false);

	return {
		isOpen,
		onToggle: () => setIsOpen((previous) => !previous),
	};
}
