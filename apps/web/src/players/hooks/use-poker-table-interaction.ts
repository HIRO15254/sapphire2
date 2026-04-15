import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { TablePlayer } from "@/live-sessions/components/poker-table";
import {
	applyOptimisticLiveSessionEvent,
	cancelLiveSessionCaches,
	getLiveSessionCacheRefs,
	invalidateLiveSessionCaches,
	type LiveSessionEvent,
	type LiveSessionEventType,
	type LiveSessionType,
	patchLiveSessionDetail,
	restoreLiveSessionCaches,
	snapshotLiveSessionCaches,
} from "@/live-sessions/lib/live-session-cache";
import { trpcClient } from "@/utils/trpc";

export interface SelectedPlayer {
	playerId: string;
	seatPosition: number;
}

function buildOptimisticEvent(
	eventType: LiveSessionEventType,
	payload: unknown
): LiveSessionEvent {
	return {
		eventType,
		id: `optimistic-${Date.now()}`,
		occurredAt: new Date().toISOString(),
		payload,
	};
}

export function usePokerTableInteraction(
	sessionType: LiveSessionType,
	sessionId: string,
	heroSeatPosition: number | null
) {
	const queryClient = useQueryClient();
	const [addPlayerSeat, setAddPlayerSeat] = useState<number | null>(null);
	const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(
		null
	);
	const refs = getLiveSessionCacheRefs({ sessionId, sessionType });

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
			await cancelLiveSessionCaches(queryClient, refs, {
				includeLists: false,
				includePlayers: false,
			});
			const snapshot = snapshotLiveSessionCaches(queryClient, refs);
			const currentHeroSeat =
				queryClient.getQueryData<{ heroSeatPosition?: number | null }>(
					refs.detailKey
				)?.heroSeatPosition ?? heroSeatPosition;

			patchLiveSessionDetail(queryClient, refs, (old) =>
				old ? { ...old, heroSeatPosition: nextSeatPosition } : old
			);

			if (currentHeroSeat === null && nextSeatPosition !== null) {
				applyOptimisticLiveSessionEvent(queryClient, refs, {
					event: buildOptimisticEvent("player_join", {
						isHero: true,
					}),
					eventType: "player_join",
					payload: {
						isHero: true,
					},
				});
			}

			if (currentHeroSeat !== null && nextSeatPosition === null) {
				applyOptimisticLiveSessionEvent(queryClient, refs, {
					event: buildOptimisticEvent("player_leave", {
						isHero: true,
					}),
					eventType: "player_leave",
					payload: {
						isHero: true,
					},
				});
			}

			return { snapshot };
		},
		onError: (_error, _variables, context) => {
			restoreLiveSessionCaches(queryClient, context?.snapshot);
		},
		onSettled: async () => {
			await invalidateLiveSessionCaches(queryClient, refs, {
				includeLists: false,
				includePlayers: false,
			});
		},
	});

	return {
		addPlayerSeat,
		handleEmptySeatTap: (seatPosition: number) => {
			if (heroSeatPosition === null) {
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
		heroSeatPosition,
		selectedPlayer,
		setAddPlayerSeat,
		setSelectedPlayer,
		waitingForHero: heroSeatPosition === null,
	};
}
