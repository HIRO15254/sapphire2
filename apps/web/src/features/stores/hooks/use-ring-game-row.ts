import { useEffect, useState } from "react";

interface UseRingGameRowOptions {
	expanded: boolean;
}

export function useRingGameRow({ expanded }: UseRingGameRowOptions) {
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	useEffect(() => {
		if (!expanded) {
			setConfirmingDelete(false);
		}
	}, [expanded]);

	return {
		confirmingDelete,
		setConfirmingDelete,
	};
}
