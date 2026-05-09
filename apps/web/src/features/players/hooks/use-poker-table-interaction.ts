import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { TablePlayer } from "@/features/live-sessions/components/poker-table";
import { getSessionQueryKeys } from "@/features/live-sessions/utils/optimistic-session-event";
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

export interface SessionDetailWithCurrentPlayers {
	currentPlayers: Array<{
		isHero: boolean;
		joinedAt: string | Date;
		playerId?: string;
		seatPosition?: number | null;
	}>;
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

	const { sessionKey, eventsKey } = getSessionQueryKeys(sessionId, sessionType);

	const [localHeroSeat, setLocalHeroSeat] = useState<number | null | undefined>(
		undefined
	);
	const effectiveHeroSeat =
		localHeroSeat === undefined ? heroSeatPosition : localHeroSeat;

	// Hero join mutation (add hero to a seat)
	const heroJoinMutation = useMutation({
		mutationFn: (nextSeatPosition: number) =>
			trpcClient.sessionEvent.addPlayer.mutate({
				sessionId,
				isHero: true,
				seatPosition: nextSeatPosition,
			}),
		onMutate: async (nextSeatPosition) => {
			await cancelTargets(queryClient, [{ queryKey: sessionKey }]);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			queryClient.setQueryData<SessionDetailWithCurrentPlayers>(
				sessionKey,
				(old) =>
					old
						? {
								...old,
								currentPlayers: [
									...old.currentPlayers.filter((p) => !p.isHero),
									{
										isHero: true,
										seatPosition: nextSeatPosition,
										joinedAt: new Date().toISOString(),
									},
								],
							}
						: old
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

	// Hero leave mutation (remove hero from seat)
	const heroLeaveMutation = useMutation({
		mutationFn: () =>
			trpcClient.sessionEvent.removePlayer.mutate({
				sessionId,
				isHero: true,
			}),
		onMutate: async () => {
			await cancelTargets(queryClient, [{ queryKey: sessionKey }]);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			queryClient.setQueryData<SessionDetailWithCurrentPlayers>(
				sessionKey,
				(old) =>
					old
						? {
								...old,
								currentPlayers: old.currentPlayers.filter((p) => !p.isHero),
							}
						: old
			);
			const previousSeat =
				localHeroSeat === undefined ? heroSeatPosition : localHeroSeat;
			setLocalHeroSeat(null);
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
				heroJoinMutation.mutate(seatPosition);
				return;
			}
			setAddPlayerSeat(seatPosition);
		},
		handleHeroSeatTap: () => {
			heroLeaveMutation.mutate();
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
