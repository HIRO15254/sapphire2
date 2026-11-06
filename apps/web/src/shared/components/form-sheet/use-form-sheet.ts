import { useCallback } from "react";

export function useFormSheet(onOpenChange: (open: boolean) => void) {
	const onCancel = useCallback(() => onOpenChange(false), [onOpenChange]);
	return { onCancel };
}
