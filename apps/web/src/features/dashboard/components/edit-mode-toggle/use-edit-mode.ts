import { useCallback, useState } from "react";

export interface UseEditModeResult {
	isEditing: boolean;
	setEditing: (next: boolean) => void;
	toggle: () => void;
}

export function useEditMode(initial = false): UseEditModeResult {
	const [isEditing, setEditing] = useState(initial);
	const toggle = useCallback(() => setEditing((prev) => !prev), []);
	return { isEditing, toggle, setEditing };
}
