import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { TablePlayer } from "@/live-sessions/components/poker-table";
import { getSessionQueryKeys } from "@/live-sessions/utils/optimistic-session-event";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpcClient } from "@/utils/trpc";

export interface SelectedPlayer {
	playerId: string;
	seatPosition: number;
}

export interface SessionDetailWithHeroSeat {
	heroSeatPosition?: number | null;
	[key: string]: unknown;
}

export function usePokerTableInteraction(
	sessionType: "cash_game" | "tournament",
	sessionId: string,
	heroSeatPosition: number | null
) {
	const queryClient = useQueryClient();
	const [addPlayerSeat, setAddPlayerSeat] = useState<number | null>(null);
	const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(
		null
	);

	const { sessionKey, eventsKey } = getSessionQueryKeys(
		sessionId,
		sessionType
	);

	const [localHeroSeat, setLocalHeroSeat] = useState<number | null | undefined>(
		undefined
	);
	const effectiveHeroSeat =
		localHeroSeat === undefined ? heroSeatPosition : localHeroSeat;

	const heroMutation = useMutation({
		mutationFn: (nextSeatPosition: number | null) =>
			sessionType === "cash_game"
				? trpcClient.liveCashGameSession.updateHeroSeat.mutate({
						id: sessionId,
						heroSeatPosition: nextSeatPosition,
					})
				: trpcClient.liveTournamentSession.updateHeroSeat.mutate({
						id: sessionId,
						heroSeatPosition: nextSeatPosition,
					}),
		onMutate: async (nextSeatPosition) => {
			await cancelTargets(queryClient, [{ queryKey: sessionKey }]);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			queryClient.setQueryData<SessionDetailWithHeroSeat>(sessionKey, (old) =>
				old ? { ...old, heroSeatPosition: nextSeatPosition } : old
			);
			const previousSeat =
				localHeroSeat === undefined ? heroSeatPosition : localHeroSeat;
			setLocalHeroSeat(nextSeatPosition);
			return { previousSeat, previousSession };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [context?.previousSession]);
			setLocalHeroSeat(context?.previousSeat ?? undefined);
		},
		onSettled: async () => {
			await invalidateTargets(queryClient, [
				{ queryKey: sessionKey },
				{ queryKey: eventsKey },
			]);
			setLocalHeroSeat(undefined);
		},
	});

	return {
		addPlayerSeat,
		handleEmptySeatTap: (seatPosition: number) => {
			if (effectiveHeroSeat === null) {
				heroMutation.mutate(seatPosition);
				return;
			}
			setAddPlayerSeat(seatPosition);
		},
		handleHeroSeatTap: () => {
			heroMutation.mutate(null);
		},
		handlePlayerSeatTap: (player: TablePlayer, seatPosition: number) => {
			setSelectedPlayer({ playerId: player.player.id, seatPosition });
		},
		heroSeatPosition: effectiveHeroSeat,
		selectedPlayer,
		setAddPlayerSeat,
		setSelectedPlayer,
		waitingForHero: effectiveHeroSeat === null,
	};
}
