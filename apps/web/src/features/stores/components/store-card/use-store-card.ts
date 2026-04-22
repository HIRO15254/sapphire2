import { useState } from "react";

export function useStoreCard() {
	const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

	const handleToggleGame = (id: string | null) => {
		setExpandedGameId(id);
	};

	return {
		expandedGameId,
		handleToggleGame,
	};
}
