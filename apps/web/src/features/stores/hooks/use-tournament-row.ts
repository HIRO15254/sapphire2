import { useEffect, useState } from "react";

interface UseTournamentRowOptions {
	expanded: boolean;
}

export function useTournamentRow({ expanded }: UseTournamentRowOptions) {
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
