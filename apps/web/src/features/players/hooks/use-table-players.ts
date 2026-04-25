import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

interface UseTablePlayersOptions {
	liveCashGameSessionId?: string;
	liveTournamentSessionId?: string;
}

interface TablePlayerItem {
	id: string;
	isActive: boolean;
	joinedAt: string;
	leftAt: string | null;
	player: {
		id: string;
		isTemporary: boolean;
		memo: string | null;
		name: string;
	};
	seatPosition: number | null;
}

interface TablePlayerData {
	items: TablePlayerItem[];
}

export function useTablePlayers({
	liveCashGameSessionId,
	liveTournamentSessionId,
}: UseTablePlayersOptions) {
	const queryClient = useQueryClient();

	const sessionParam = liveCashGameSessionId
		? { liveCashGameSessionId }
		: { liveTournamentSessionId: liveTournamentSessionId ?? "" };

	const playersQuery = useQuery({
		...trpc.sessionTablePlayer.list.queryOptions(sessionParam),
		enabled: !!(liveCashGameSessionId || liveTournamentSessionId),
		refetchInterval: 5000,
	});

	const playersKey =
		trpc.sessionTablePlayer.list.queryOptions(sessionParam).queryKey;

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
			await cancelTargets(queryClient, [{ queryKey: playersKey }]);
			const previous = snapshotQuery<TablePlayerData>(queryClient, playersKey);
			queryClient.setQueryData<TablePlayerData>(playersKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					items: [
						...old.items,
						{
							id: `optimistic-${Date.now()}`,
							player: {
								id: params.playerId,
								isTemporary: false,
								memo: null,
								name: params.playerName,
							},
							isActive: true,
							joinedAt: new Date().toISOString(),
							leftAt: null,
							seatPosition: params.seatPosition,
						},
					],
				};
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: playersKey }]);
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
			await cancelTargets(queryClient, [{ queryKey: playersKey }]);
			const previous = snapshotQuery<TablePlayerData>(queryClient, playersKey);
			queryClient.setQueryData<TablePlayerData>(playersKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					items: [
						...old.items,
						{
							id: `optimistic-${Date.now()}`,
							player: {
								id: `new-${Date.now()}`,
								isTemporary: false,
								memo: params.playerMemo ?? null,
								name: params.playerName,
							},
							isActive: true,
							joinedAt: new Date().toISOString(),
							leftAt: null,
							seatPosition: params.seatPosition,
						},
					],
				};
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: playersKey },
				{ queryKey: trpc.player.list.queryOptions().queryKey },
			]);
		},
	});

	const addTemporaryMutation = useMutation({
		mutationFn: (params: { seatPosition: number }) =>
			trpcClient.sessionTablePlayer.addTemporary.mutate({
				...sessionParam,
				seatPosition: params.seatPosition,
			}),
		onMutate: async (params) => {
			await cancelTargets(queryClient, [{ queryKey: playersKey }]);
			const previous = snapshotQuery<TablePlayerData>(queryClient, playersKey);
			queryClient.setQueryData<TablePlayerData>(playersKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					items: [
						...old.items,
						{
							id: `optimistic-${Date.now()}`,
							player: {
								id: `temp-${Date.now()}`,
								isTemporary: true,
								memo: null,
								name: "...",
							},
							isActive: true,
							joinedAt: new Date().toISOString(),
							leftAt: null,
							seatPosition: params.seatPosition,
						},
					],
				};
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: playersKey }]);
		},
	});

	const removeMutation = useMutation({
		mutationFn: (playerId: string) =>
			trpcClient.sessionTablePlayer.remove.mutate({
				...sessionParam,
				playerId,
			}),
		onMutate: async (playerId) => {
			await cancelTargets(queryClient, [{ queryKey: playersKey }]);
			const previous = snapshotQuery<TablePlayerData>(queryClient, playersKey);
			queryClient.setQueryData<TablePlayerData>(playersKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					items: old.items.map((item) =>
						item.player.id === playerId
							? { ...item, isActive: false, leftAt: new Date().toISOString() }
							: item
					),
				};
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: playersKey }]);
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
			await cancelTargets(queryClient, [{ queryKey: playersKey }]);
			const previous = snapshotQuery<TablePlayerData>(queryClient, playersKey);
			queryClient.setQueryData<TablePlayerData>(playersKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					items: old.items.map((item) =>
						item.player.id === params.playerId
							? { ...item, seatPosition: params.seatPosition }
							: item
					),
				};
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: playersKey }]);
		},
	});

	const players = (playersQuery.data?.items ?? []).map((item) => ({
		id: item.id,
		isActive: item.isActive,
		isLoading: item.id.startsWith("optimistic-"),
		player: {
			id: item.player.id,
			isTemporary: item.player.isTemporary,
			name: item.player.name,
		},
		seatPosition: item.seatPosition ?? null,
	}));

	const excludePlayerIds = players
		.filter((p) => p.isActive)
		.map((p) => p.player.id);

	return {
		players,
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
		handleAddTemporary: (seatPosition: number) => {
			addTemporaryMutation.mutate({ seatPosition });
		},
		handleRemovePlayer: (playerId: string) => {
			removeMutation.mutate(playerId);
		},
		updateSeatMutation,
	};
}
