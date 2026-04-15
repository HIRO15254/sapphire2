import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	applyOptimisticLiveSessionEvent,
	cancelLiveSessionCaches,
	getLiveSessionCacheRefs,
	invalidateLiveSessionCaches,
	type LiveSessionEvent,
	type LiveSessionEventType,
	type LiveSessionPlayersData,
	type LiveSessionTablePlayerItem,
	type LiveSessionType,
	patchLiveSessionPlayers,
	restoreLiveSessionCaches,
	snapshotLiveSessionCaches,
} from "@/live-sessions/lib/live-session-cache";
import { trpc, trpcClient } from "@/utils/trpc";

interface UseTablePlayersOptions {
	liveCashGameSessionId?: string;
	liveTournamentSessionId?: string;
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

function getSessionContext({
	liveCashGameSessionId,
	liveTournamentSessionId,
}: UseTablePlayersOptions): {
	sessionId: string;
	sessionParam:
		| { liveCashGameSessionId: string }
		| { liveTournamentSessionId: string };
	sessionType: LiveSessionType;
} {
	if (liveCashGameSessionId) {
		return {
			sessionId: liveCashGameSessionId,
			sessionParam: { liveCashGameSessionId },
			sessionType: "cash_game",
		};
	}

	return {
		sessionId: liveTournamentSessionId ?? "",
		sessionParam: { liveTournamentSessionId: liveTournamentSessionId ?? "" },
		sessionType: "tournament",
	};
}

function buildOptimisticPlayer(
	params: {
		playerId: string;
		playerMemo?: string;
		playerName: string;
		seatPosition: number;
	},
	id = `optimistic-${Date.now()}`
): LiveSessionTablePlayerItem {
	return {
		id,
		player: {
			id: params.playerId,
			memo: params.playerMemo ?? null,
			name: params.playerName,
		},
		isActive: true,
		joinedAt: new Date().toISOString(),
		leftAt: null,
		seatPosition: params.seatPosition,
	};
}

export function useTablePlayers({
	liveCashGameSessionId,
	liveTournamentSessionId,
}: UseTablePlayersOptions) {
	const queryClient = useQueryClient();
	const { sessionId, sessionParam, sessionType } = getSessionContext({
		liveCashGameSessionId,
		liveTournamentSessionId,
	});
	const refs = getLiveSessionCacheRefs({ sessionId, sessionType });

	const playersQuery = useQuery({
		...trpc.sessionTablePlayer.list.queryOptions(sessionParam),
		enabled: !!(liveCashGameSessionId || liveTournamentSessionId),
		refetchInterval: 5000,
	});

	const addMutation = useMutation({
		mutationFn: (params: {
			playerId: string;
			playerName: string;
			seatPosition: number;
		}) =>
			trpcClient.sessionTablePlayer.add.mutate({
				...sessionParam,
				playerId: params.playerId,
				seatPosition: params.seatPosition,
			}),
		onMutate: async (params) => {
			await cancelLiveSessionCaches(queryClient, refs, {
				includeLists: false,
			});
			const snapshot = snapshotLiveSessionCaches(queryClient, refs);

			patchLiveSessionPlayers(queryClient, refs, (currentPlayers) => [
				...currentPlayers,
				buildOptimisticPlayer({
					playerId: params.playerId,
					playerName: params.playerName,
					seatPosition: params.seatPosition,
				}),
			]);
			applyOptimisticLiveSessionEvent(queryClient, refs, {
				event: buildOptimisticEvent("player_join", {
					playerId: params.playerId,
				}),
				eventType: "player_join",
				payload: {
					playerId: params.playerId,
				},
			});

			return { snapshot };
		},
		onError: (_err, _vars, ctx) => {
			restoreLiveSessionCaches(queryClient, ctx?.snapshot);
		},
		onSettled: async () => {
			await invalidateLiveSessionCaches(queryClient, refs, {
				includeLists: false,
			});
		},
	});

	const addNewMutation = useMutation({
		mutationFn: (params: {
			playerMemo?: string;
			playerName: string;
			playerTagIds?: string[];
			seatPosition: number;
		}) =>
			trpcClient.sessionTablePlayer.addNew.mutate({
				...sessionParam,
				playerMemo: params.playerMemo,
				playerName: params.playerName,
				playerTagIds: params.playerTagIds,
				seatPosition: params.seatPosition,
			}),
		onMutate: async (params) => {
			await cancelLiveSessionCaches(queryClient, refs, {
				includeLists: false,
			});
			const snapshot = snapshotLiveSessionCaches(queryClient, refs);
			const optimisticPlayerId = `new-${Date.now()}`;

			patchLiveSessionPlayers(queryClient, refs, (currentPlayers) => [
				...currentPlayers,
				buildOptimisticPlayer({
					playerId: optimisticPlayerId,
					playerMemo: params.playerMemo,
					playerName: params.playerName,
					seatPosition: params.seatPosition,
				}),
			]);
			applyOptimisticLiveSessionEvent(queryClient, refs, {
				event: buildOptimisticEvent("player_join", {
					playerId: optimisticPlayerId,
				}),
				eventType: "player_join",
				payload: {
					playerId: optimisticPlayerId,
				},
			});

			return { snapshot };
		},
		onError: (_err, _vars, ctx) => {
			restoreLiveSessionCaches(queryClient, ctx?.snapshot);
		},
		onSettled: async () => {
			await Promise.all([
				invalidateLiveSessionCaches(queryClient, refs, {
					includeLists: false,
				}),
				queryClient.invalidateQueries({
					queryKey: trpc.player.list.queryOptions().queryKey,
				}),
			]);
		},
	});

	const removeMutation = useMutation({
		mutationFn: (playerId: string) =>
			trpcClient.sessionTablePlayer.remove.mutate({
				...sessionParam,
				playerId,
			}),
		onMutate: async (playerId) => {
			await cancelLiveSessionCaches(queryClient, refs, {
				includeLists: false,
			});
			const snapshot = snapshotLiveSessionCaches(queryClient, refs);

			patchLiveSessionPlayers(queryClient, refs, (currentPlayers) =>
				currentPlayers.map((item) =>
					item.player.id === playerId
						? {
								...item,
								isActive: false,
								leftAt: new Date().toISOString(),
							}
						: item
				)
			);
			applyOptimisticLiveSessionEvent(queryClient, refs, {
				event: buildOptimisticEvent("player_leave", {
					playerId,
				}),
				eventType: "player_leave",
				payload: {
					playerId,
				},
			});

			return { snapshot };
		},
		onError: (_err, _vars, ctx) => {
			restoreLiveSessionCaches(queryClient, ctx?.snapshot);
		},
		onSettled: async () => {
			await invalidateLiveSessionCaches(queryClient, refs, {
				includeLists: false,
			});
		},
	});

	const updateSeatMutation = useMutation({
		mutationFn: (params: { playerId: string; seatPosition: number | null }) =>
			trpcClient.sessionTablePlayer.updateSeat.mutate({
				...sessionParam,
				playerId: params.playerId,
				seatPosition: params.seatPosition,
			}),
		onMutate: async (params) => {
			await cancelLiveSessionCaches(queryClient, refs, {
				includeEvents: false,
				includeLists: false,
			});
			const snapshot = snapshotLiveSessionCaches(queryClient, refs);

			patchLiveSessionPlayers(queryClient, refs, (currentPlayers) =>
				currentPlayers.map((item) =>
					item.player.id === params.playerId
						? { ...item, seatPosition: params.seatPosition }
						: item
				)
			);

			return { snapshot };
		},
		onError: (_err, _vars, ctx) => {
			restoreLiveSessionCaches(queryClient, ctx?.snapshot);
		},
		onSettled: async () => {
			await invalidateLiveSessionCaches(queryClient, refs, {
				includeEvents: false,
				includeLists: false,
			});
		},
	});

	const players = ((playersQuery.data as LiveSessionPlayersData | undefined)
		?.items ?? []) as LiveSessionTablePlayerItem[];

	const visiblePlayers = players.map((item) => ({
		id: item.id,
		isActive: item.isActive,
		player: { id: item.player.id, name: item.player.name },
		seatPosition: item.seatPosition ?? null,
	}));

	const excludePlayerIds = visiblePlayers
		.filter((p) => p.isActive)
		.map((p) => p.player.id);

	return {
		players: visiblePlayers,
		excludePlayerIds,
		handleAddExisting: (
			playerId: string,
			playerName: string,
			seatPosition: number
		) => {
			addMutation.mutate({ playerId, playerName, seatPosition });
		},
		handleAddNew: (
			name: string,
			seatPosition: number,
			memo?: string,
			tagIds?: string[]
		) => {
			addNewMutation.mutate({
				playerMemo: memo,
				playerName: name,
				playerTagIds: tagIds,
				seatPosition,
			});
		},
		handleRemovePlayer: (playerId: string) => {
			removeMutation.mutate(playerId);
		},
		updateSeatMutation,
	};
}
