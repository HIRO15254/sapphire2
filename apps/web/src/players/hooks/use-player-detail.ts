import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQueries,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface PlayerTagWithColor {
	color: string;
	id: string;
	name: string;
}

export interface PlayerTagQueryItem extends PlayerTagWithColor {
	createdAt: string;
	updatedAt: string;
	userId: string;
}

export interface PlayerDetailData {
	id: string;
	memo: string | null;
	name: string;
	tags: PlayerTagWithColor[];
}

export interface PlayerListItemWithTags {
	id: string;
	memo: string | null;
	name: string;
	tags: PlayerTagWithColor[];
}

export function usePlayerDetail(playerId: string | null) {
	const queryClient = useQueryClient();

	const playerQuery = useQuery({
		...trpc.player.getById.queryOptions({ id: playerId ?? "" }),
		enabled: !!playerId,
	});

	const tagsQuery = useQuery({
		...trpc.playerTag.list.queryOptions(),
	});

	const playerKey = trpc.player.getById.queryOptions({
		id: playerId ?? "",
	}).queryKey;
	const tagsKey = trpc.playerTag.list.queryOptions().queryKey;
	const playerListKey = trpc.player.list.queryOptions().queryKey;

	const updateMutation = useMutation({
		mutationFn: (values: {
			id: string;
			memo?: string | null;
			name?: string;
			tagIds?: string[];
		}) => trpcClient.player.update.mutate(values),
		onMutate: async (values) => {
			await cancelTargets(queryClient, [
				{ queryKey: playerKey },
				{ filters: { queryKey: playerListKey } },
			]);
			const previousPlayer = snapshotQuery(queryClient, playerKey);
			const previousLists = snapshotQueries(queryClient, {
				queryKey: playerListKey,
			});
			const nextTags =
				values.tagIds === undefined
					? ((previousPlayer.data as PlayerDetailData | null | undefined)
							?.tags ?? [])
					: (tagsQuery.data ?? []).filter((tag) =>
							values.tagIds?.includes(tag.id)
						);
			queryClient.setQueryData<PlayerDetailData | null>(playerKey, (old) =>
				old
					? {
							...old,
							memo: values.memo ?? old.memo,
							name: values.name ?? old.name,
							tags: nextTags as PlayerTagWithColor[],
						}
					: old
			);
			queryClient.setQueriesData<PlayerListItemWithTags[]>(
				{ queryKey: playerListKey },
				(old) =>
					old?.map((player) =>
						player.id === values.id
							? {
									...player,
									memo: values.memo ?? player.memo,
									name: values.name ?? player.name,
									tags: nextTags as PlayerTagWithColor[],
								}
							: player
					)
			);
			return { previousLists, previousPlayer };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousPlayer,
				context?.previousLists,
			]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: playerKey },
				{ filters: { queryKey: playerListKey } },
			]);
		},
	});

	const createTagMutation = useMutation({
		mutationFn: (name: string) => trpcClient.playerTag.create.mutate({ name }),
		onMutate: async (name) => {
			await cancelTargets(queryClient, [{ queryKey: tagsKey }]);
			const previousTags = snapshotQuery(queryClient, tagsKey);
			const optimisticTag: PlayerTagQueryItem = {
				color: "gray",
				createdAt: new Date().toISOString(),
				id: `temp-tag-${Date.now()}`,
				name,
				updatedAt: new Date().toISOString(),
				userId: "",
			};
			queryClient.setQueryData<PlayerTagQueryItem[]>(tagsKey, (old) => [
				...(old ?? []),
				optimisticTag,
			]);
			return { previousTags };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [context?.previousTags]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: tagsKey }]);
		},
	});

	return {
		availableTags: (tagsQuery.data ?? []) as PlayerTagWithColor[],
		createTag: async (name: string) => {
			const createdTag = await createTagMutation.mutateAsync(name);
			return createdTag as PlayerTagWithColor;
		},
		isSaving: updateMutation.isPending,
		player: playerQuery.data ?? null,
		updatePlayer: updateMutation.mutate,
	};
}
