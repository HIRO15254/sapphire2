import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

interface UseCurrentPlayersListArgs {
	sessionId: string;
}

export function useCurrentPlayersList({
	sessionId,
}: UseCurrentPlayersListArgs) {
	const sessionQuery = useQuery({
		...trpc.liveSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});

	const currentPlayers = sessionQuery.data?.currentPlayers ?? [];

	return {
		currentPlayers,
		isLoading: sessionQuery.isLoading,
	};
}
