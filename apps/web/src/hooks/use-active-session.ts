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
	const cashQuery = useQuery(
		trpc.liveCashGameSession.list.queryOptions({ status: "active", limit: 1 })
	);
	const tournamentQuery = useQuery(
		trpc.liveTournamentSession.list.queryOptions({
			status: "active",
			limit: 1,
		})
	);

	const isLoading = cashQuery.isLoading || tournamentQuery.isLoading;

	const activeCash = cashQuery.data?.items?.[0];
	const activeTournament = tournamentQuery.data?.items?.[0];

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
