import { type ChangeEvent, useCallback } from "react";

export function useCheckedChange(onCheckedChange: (checked: boolean) => void) {
	return useCallback(
		(event: ChangeEvent<HTMLInputElement>) =>
			onCheckedChange(event.target.checked),
		[onCheckedChange]
	);
}
