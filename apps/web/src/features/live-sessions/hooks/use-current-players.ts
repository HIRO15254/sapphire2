import { useQuery } from "@tanstack/react-query";
import { trpc } from "@/utils/trpc";

export interface CurrentPlayer {
	isHero: boolean;
	joinedAt: string | Date;
	playerId?: string;
	seatPosition?: number | null;
}

export function useCurrentPlayers(sessionId: string) {
	const sessionQuery = useQuery({
		...trpc.liveSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
		refetchInterval: 5000,
	});

	const currentPlayers: CurrentPlayer[] =
		sessionQuery.data?.currentPlayers ?? [];

	const heroPlayer = currentPlayers.find((p) => p.isHero) ?? null;
	const heroSeatPosition = heroPlayer?.seatPosition ?? null;

	return {
		currentPlayers,
		heroPlayer,
		heroSeatPosition,
		isLoading: sessionQuery.isLoading,
	};
}
