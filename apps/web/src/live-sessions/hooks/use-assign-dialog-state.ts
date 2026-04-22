import { useState } from "react";

export function useAssignDialogState() {
	const [isAssignOpen, setIsAssignOpen] = useState(false);
	return { isAssignOpen, setIsAssignOpen };
}
