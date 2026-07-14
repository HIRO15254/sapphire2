import { useId } from "react";

export function useField() {
	const id = useId();

	return {
		errorId: `field-error-${id.replaceAll(":", "")}`,
	};
}
