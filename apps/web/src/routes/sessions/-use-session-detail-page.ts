import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export function useSessionDetailPage(sessionId: string) {
	const sessionQuery = useQuery(
		trpc.session.getById.queryOptions({ id: sessionId })
	);

	const session = sessionQuery.data;
	const isLoading = sessionQuery.isLoading;

	const sessionType: "cash_game" | "tournament" =
		session?.kind === "tournament" ? "tournament" : "cash_game";

	const isLive = session?.source === "live";
	const isDiscarded = session?.status === "discarded";

	return {
		session,
		isLoading,
		sessionType,
		isLive,
		isDiscarded,
	};
}
