import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

/**
 * The aggregated multi-day "flight" for a tournament session, or null when the
 * session is single-day (or not a live tournament). Keyed by the live
 * tournament session id (`session.liveTournamentSessionId`).
 */
export function useSessionFlight(liveTournamentSessionId: string | null) {
	const query = useQuery({
		...trpc.liveTournamentSession.getFlight.queryOptions({
			id: liveTournamentSessionId ?? "",
		}),
		enabled: liveTournamentSessionId !== null,
	});
	return query.data ?? null;
}
