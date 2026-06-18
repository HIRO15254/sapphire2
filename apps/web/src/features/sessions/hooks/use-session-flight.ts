import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

/**
 * The aggregated multi-day "flight" for a tournament session, or null when the
 * session is single-day. Keyed by the session id (== game_session.id), so it
 * works for both live and manually recorded multi-day chains. Pass null for
 * non-tournament sessions to skip the query.
 */
export function useSessionFlight(tournamentSessionId: string | null) {
	const query = useQuery({
		...trpc.liveTournamentSession.getFlight.queryOptions({
			id: tournamentSessionId ?? "",
		}),
		enabled: tournamentSessionId !== null,
	});
	return query.data ?? null;
}
