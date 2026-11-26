import { useCallback } from "react";

export function useConfirmDialog(onOpenChange: (open: boolean) => void) {
	const onCancel = useCallback(() => onOpenChange(false), [onOpenChange]);
	return { onCancel };
}
