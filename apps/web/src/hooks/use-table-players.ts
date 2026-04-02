import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { trpc, trpcClient } from "@/utils/trpc";

interface UseTablePlayersOptions {
	liveCashGameSessionId?: string;
	liveTournamentSessionId?: string;
}

export function useTablePlayers({
	liveCashGameSessionId,
	liveTournamentSessionId,
}: UseTablePlayersOptions) {
	const queryClient = useQueryClient();
	const [addPlayerSeat, setAddPlayerSeat] = useState<number | null>(null);

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
		mutationFn: (params: { playerId: string; seatPosition?: number }) =>
			trpcClient.sessionTablePlayer.add.mutate({
				...sessionParam,
				playerId: params.playerId,
				seatPosition: params.seatPosition,
			}),
		onSuccess: invalidatePlayers,
	});

	const addNewMutation = useMutation({
		mutationFn: (params: {
			playerName: string;
			playerMemo?: string;
			seatPosition?: number;
		}) =>
			trpcClient.sessionTablePlayer.addNew.mutate({
				...sessionParam,
				playerName: params.playerName,
				playerMemo: params.playerMemo,
				seatPosition: params.seatPosition,
			}),
		onSuccess: invalidatePlayers,
	});

	const removeMutation = useMutation({
		mutationFn: (playerId: string) =>
			trpcClient.sessionTablePlayer.remove.mutate({
				...sessionParam,
				playerId,
			}),
		onSuccess: invalidatePlayers,
	});

	const updateSeatMutation = useMutation({
		mutationFn: (params: { playerId: string; seatPosition: number | null }) =>
			trpcClient.sessionTablePlayer.updateSeat.mutate({
				...sessionParam,
				playerId: params.playerId,
				seatPosition: params.seatPosition,
			}),
		onSuccess: invalidatePlayers,
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

	const handleAddPlayer = (seatPosition: number) => {
		setAddPlayerSeat(seatPosition);
	};

	const handleAddExisting = (playerId: string) => {
		addMutation.mutate({
			playerId,
			seatPosition: addPlayerSeat ?? undefined,
		});
	};

	const handleAddNew = (name: string, memo?: string) => {
		addNewMutation.mutate({
			playerName: name,
			playerMemo: memo,
			seatPosition: addPlayerSeat ?? undefined,
		});
	};

	const handleRemovePlayer = (playerId: string) => {
		removeMutation.mutate(playerId);
	};

	return {
		players,
		excludePlayerIds,
		addPlayerSheetOpen: addPlayerSeat !== null,
		setAddPlayerSheetOpen: (open: boolean) => {
			if (!open) {
				setAddPlayerSeat(null);
			}
		},
		handleAddPlayer,
		handleAddExisting,
		handleAddNew,
		handleRemovePlayer,
		updateSeatMutation,
	};
}
