import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { trpc } from "@/utils/trpc";

export function useStoreDetailPage(storeId: string) {
	const storeQuery = useQuery(trpc.store.getById.queryOptions({ id: storeId }));
	const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

	const handleToggleGame = (id: string | null) => {
		setExpandedGameId(id);
	};

	return {
		store: storeQuery.data,
		isLoading: storeQuery.isLoading,
		expandedGameId,
		handleToggleGame,
	};
}
