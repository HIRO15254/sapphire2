import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

interface UseTablePlayersOptions {
	sessionId: string;
}

interface CurrentPlayerItem {
	isHero: boolean;
	joinedAt: string | Date;
	playerId?: string;
	seatPosition?: number | null;
}

export function useTablePlayers({ sessionId }: UseTablePlayersOptions) {
	const queryClient = useQueryClient();

	const sessionQueryOptions = trpc.liveSession.getById.queryOptions({
		id: sessionId,
	});

	const sessionQuery = useQuery({
		...sessionQueryOptions,
		enabled: !!sessionId,
		refetchInterval: 5000,
	});

	const playersKey = sessionQueryOptions.queryKey;

	const currentPlayers: CurrentPlayerItem[] =
		sessionQuery.data?.currentPlayers ?? [];

	const addMutation = useMutation({
		mutationFn: (params: { playerId: string; seatPosition?: number }) =>
			trpcClient.sessionEvent.addPlayer.mutate({
				sessionId,
				playerId: params.playerId,
				isHero: false,
				seatPosition: params.seatPosition,
			}),
		onMutate: async (params) => {
			await cancelTargets(queryClient, [{ queryKey: playersKey }]);
			const previous = snapshotQuery(queryClient, playersKey);
			queryClient.setQueryData(playersKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					...old,
					currentPlayers: [
						...old.currentPlayers,
						{
							playerId: params.playerId,
							isHero: false,
							seatPosition: params.seatPosition ?? null,
							joinedAt: new Date().toISOString(),
						},
					],
				} as typeof old;
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

	const addTemporaryMutation = useMutation({
		mutationFn: (params: { name: string; seatPosition?: number }) =>
			trpcClient.sessionEvent.addTemporaryPlayer.mutate({
				sessionId,
				name: params.name,
				seatPosition: params.seatPosition,
			}),
		onMutate: async (params) => {
			await cancelTargets(queryClient, [{ queryKey: playersKey }]);
			const previous = snapshotQuery(queryClient, playersKey);
			queryClient.setQueryData(playersKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					...old,
					currentPlayers: [
						...old.currentPlayers,
						{
							playerId: `temp-${Date.now()}`,
							isHero: false,
							seatPosition: params.seatPosition ?? null,
							joinedAt: new Date().toISOString(),
						},
					],
				} as typeof old;
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

	const removeMutation = useMutation({
		mutationFn: (playerId: string) =>
			trpcClient.sessionEvent.removePlayer.mutate({
				sessionId,
				playerId,
				isHero: false,
			}),
		onMutate: async (playerId) => {
			await cancelTargets(queryClient, [{ queryKey: playersKey }]);
			const previous = snapshotQuery(queryClient, playersKey);
			queryClient.setQueryData(playersKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					...old,
					currentPlayers: old.currentPlayers.filter(
						(p: { playerId?: string }) => p.playerId !== playerId
					),
				} as typeof old;
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

	const excludePlayerIds = currentPlayers
		.filter((p) => !p.isHero && p.playerId)
		.map((p) => p.playerId as string);

	return {
		players: currentPlayers,
		excludePlayerIds,
		handleAddExisting: (playerId: string, seatPosition?: number) => {
			addMutation.mutate({ playerId, seatPosition });
		},
		handleAddTemporary: (name: string, seatPosition?: number) => {
			addTemporaryMutation.mutate({ name, seatPosition });
		},
		handleRemovePlayer: (playerId: string) => {
			removeMutation.mutate(playerId);
		},
	};
}
