import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
	player: { id: string; memo: string | null; name: string };
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

	const invalidatePlayers = () =>
		queryClient.invalidateQueries({ queryKey: playersKey });

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
			await queryClient.cancelQueries({ queryKey: playersKey });
			const prev = queryClient.getQueryData<TablePlayerData>(playersKey);
			if (prev) {
				queryClient.setQueryData<TablePlayerData>(playersKey, {
					items: [
						...prev.items,
						{
							id: `optimistic-${Date.now()}`,
							player: {
								id: params.playerId,
								name: params.playerName,
								memo: null,
							},
							isActive: true,
							joinedAt: new Date().toISOString(),
							leftAt: null,
							seatPosition: params.seatPosition,
						},
					],
				});
			}
			return { prev };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.prev) {
				queryClient.setQueryData(playersKey, ctx.prev);
			}
		},
		onSettled: invalidatePlayers,
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
			await queryClient.cancelQueries({ queryKey: playersKey });
			const prev = queryClient.getQueryData<TablePlayerData>(playersKey);
			if (prev) {
				queryClient.setQueryData<TablePlayerData>(playersKey, {
					items: [
						...prev.items,
						{
							id: `optimistic-${Date.now()}`,
							player: {
								id: `new-${Date.now()}`,
								name: params.playerName,
								memo: params.playerMemo ?? null,
							},
							isActive: true,
							joinedAt: new Date().toISOString(),
							leftAt: null,
							seatPosition: params.seatPosition,
						},
					],
				});
			}
			return { prev };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.prev) {
				queryClient.setQueryData(playersKey, ctx.prev);
			}
		},
		onSettled: () => {
			invalidatePlayers();
			queryClient.invalidateQueries({
				queryKey: trpc.player.list.queryOptions().queryKey,
			});
		},
	});

	const removeMutation = useMutation({
		mutationFn: (playerId: string) =>
			trpcClient.sessionTablePlayer.remove.mutate({
				...sessionParam,
				playerId,
			}),
		onMutate: async (playerId) => {
			await queryClient.cancelQueries({ queryKey: playersKey });
			const prev = queryClient.getQueryData<TablePlayerData>(playersKey);
			if (prev) {
				queryClient.setQueryData<TablePlayerData>(playersKey, {
					items: prev.items.map((item) =>
						item.player.id === playerId
							? { ...item, isActive: false, leftAt: new Date().toISOString() }
							: item
					),
				});
			}
			return { prev };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.prev) {
				queryClient.setQueryData(playersKey, ctx.prev);
			}
		},
		onSettled: invalidatePlayers,
	});

	const updateSeatMutation = useMutation({
		mutationFn: (params: { playerId: string; seatPosition: number | null }) =>
			trpcClient.sessionTablePlayer.updateSeat.mutate({
				...sessionParam,
				playerId: params.playerId,
				seatPosition: params.seatPosition,
			}),
		onMutate: async (params) => {
			await queryClient.cancelQueries({ queryKey: playersKey });
			const prev = queryClient.getQueryData<TablePlayerData>(playersKey);
			if (prev) {
				queryClient.setQueryData<TablePlayerData>(playersKey, {
					items: prev.items.map((item) =>
						item.player.id === params.playerId
							? { ...item, seatPosition: params.seatPosition }
							: item
					),
				});
			}
			return { prev };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.prev) {
				queryClient.setQueryData(playersKey, ctx.prev);
			}
		},
		onSettled: invalidatePlayers,
	});

	const players = (playersQuery.data?.items ?? []).map((item) => ({
		id: item.id,
		isActive: item.isActive,
		player: { id: item.player.id, name: item.player.name },
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
		handleRemovePlayer: (playerId: string) => {
			removeMutation.mutate(playerId);
		},
		updateSeatMutation,
	};
}
