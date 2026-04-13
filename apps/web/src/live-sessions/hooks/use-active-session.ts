import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

interface ActiveSessionInfo {
	id: string;
	type: "cash_game" | "tournament";
}

interface UseActiveSessionResult {
	activeSession: ActiveSessionInfo | null;
	hasActive: boolean;
	isLoading: boolean;
}

export function useActiveSession(): UseActiveSessionResult {
	const cashActiveQuery = useQuery(
		trpc.liveCashGameSession.list.queryOptions({ status: "active", limit: 1 })
	);
	const cashPausedQuery = useQuery(
		trpc.liveCashGameSession.list.queryOptions({ status: "paused", limit: 1 })
	);
	const tournamentActiveQuery = useQuery(
		trpc.liveTournamentSession.list.queryOptions({
			status: "active",
			limit: 1,
		})
	);
	const tournamentPausedQuery = useQuery(
		trpc.liveTournamentSession.list.queryOptions({
			status: "paused",
			limit: 1,
		})
	);

	const isLoading =
		cashActiveQuery.isLoading ||
		cashPausedQuery.isLoading ||
		tournamentActiveQuery.isLoading ||
		tournamentPausedQuery.isLoading;

	const activeCash =
		cashActiveQuery.data?.items?.[0] ?? cashPausedQuery.data?.items?.[0];
	const activeTournament =
		tournamentActiveQuery.data?.items?.[0] ??
		tournamentPausedQuery.data?.items?.[0];

	let activeSession: ActiveSessionInfo | null = null;
	if (activeCash) {
		activeSession = { id: activeCash.id, type: "cash_game" };
	} else if (activeTournament) {
		activeSession = { id: activeTournament.id, type: "tournament" };
	}

	return {
		activeSession,
		hasActive: activeSession !== null,
		isLoading,
	};
}
