import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

interface ActiveSessionInfo {
	id: string;
	kind: "cash_game" | "tournament";
	status: "active" | "paused";
}

interface UseActiveSessionResult {
	activeSession: ActiveSessionInfo | null;
	hasActive: boolean;
	isLoading: boolean;
}

export function useActiveSession(): UseActiveSessionResult {
	// Fetch recent sessions; live sessions in progress will have source='live'
	// and status 'active' or 'paused'. Session list is sorted by sessionDate desc.
	const listQuery = useQuery(trpc.session.list.queryOptions({}));

	const isLoading = listQuery.isLoading;

	const items = listQuery.data?.items ?? [];

	// Find the first live session that is active or paused
	const liveActiveItem = items.find(
		(item) => item.source === "live" && item.status === "active"
	);
	const livePausedItem = items.find(
		(item) => item.source === "live" && item.status === "paused"
	);

	const found = liveActiveItem ?? livePausedItem ?? null;

	let activeSession: ActiveSessionInfo | null = null;
	if (found) {
		activeSession = {
			id: found.id,
			kind: found.kind as "cash_game" | "tournament",
			status: liveActiveItem ? "active" : "paused",
		};
	}

	return {
		activeSession,
		hasActive: activeSession !== null,
		isLoading,
	};
}
