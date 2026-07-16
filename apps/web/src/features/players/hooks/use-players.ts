import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlayerFormValues } from "@/features/players/components/player-form";
import {
	cancelTargets,
	createOptimisticId,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
	updateQueryItems,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface PlayerItem {
	createdAt: string;
	id: string;
	isTemporary: boolean;
	memo: string | null;
	name: string;
	tags: Array<{ id: string; name: string; color: string }>;
	updatedAt: string;
	userId: string;
}

export function usePlayers(filterTagIds: string[]) {
	const queryClient = useQueryClient();

	const playerListOptions = trpc.player.list.queryOptions(
		filterTagIds.length > 0 ? { tagIds: filterTagIds } : undefined
	);
	const playerListKey = playerListOptions.queryKey;

	const playersQuery = useQuery(playerListOptions);
	const players = playersQuery.data ?? [];

	const tagsQuery = useQuery(trpc.playerTag.list.queryOptions());
	const availableTags = (tagsQuery.data ?? []) as Array<{
		color: string;
		id: string;
		name: string;
	}>;

	const createTag = async (name: string) => {
		const created = await trpcClient.playerTag.create.mutate({ name });
		invalidateTargets(queryClient, [
			{ queryKey: trpc.playerTag.list.queryOptions().queryKey },
		]);
		if (!created) {
			throw new Error("Failed to create player tag");
		}
		return { id: created.id, name: created.name, color: created.color };
	};

	const createMutation = useMutation({
		mutationFn: (values: PlayerFormValues) =>
			trpcClient.player.create.mutate({
				...values,
				memo: values.memo ?? undefined,
			}),
		onMutate: async (newPlayer) => {
			await cancelTargets(queryClient, [{ queryKey: playerListKey }]);
			const previous = snapshotQuery(queryClient, playerListKey);
			updateQueryItems<PlayerItem>(queryClient, playerListKey, (old) => {
				const tagIds = newPlayer.tagIds;
				const newTags = tagIds
					? availableTags.filter((t) => tagIds.includes(t.id))
					: [];
				return [
					...old,
					{
						id: createOptimisticId("temp"),
						isTemporary: false,
						name: newPlayer.name,
						memo: newPlayer.memo ?? null,
						tags: newTags,
						createdAt: new Date().toISOString(),
						updatedAt: new Date().toISOString(),
						userId: "",
					},
				];
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: playerListKey }]);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: PlayerFormValues & { id: string }) =>
			trpcClient.player.update.mutate(values),
		onMutate: async (updated) => {
			await cancelTargets(queryClient, [{ queryKey: playerListKey }]);
			const previous = snapshotQuery(queryClient, playerListKey);
			updateQueryItems<PlayerItem>(queryClient, playerListKey, (old) => {
				return old.map((p) => {
					if (p.id !== updated.id) {
						return p;
					}
					const tagIds = updated.tagIds;
					const newTags = tagIds
						? availableTags.filter((t) => tagIds.includes(t.id))
						: p.tags;
					return {
						...p,
						name: updated.name,
						memo: Object.hasOwn(updated, "memo")
							? (updated.memo ?? null)
							: p.memo,
						tags: newTags,
					};
				});
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: playerListKey }]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.player.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: playerListKey }]);
			const previous = snapshotQuery(queryClient, playerListKey);
			updateQueryItems<PlayerItem>(queryClient, playerListKey, (old) =>
				old?.filter((p) => p.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: playerListKey }]);
		},
	});

	return {
		players,
		availableTags,
		isLoading: playersQuery.isLoading,
		isInitialLoadError: playersQuery.isError && playersQuery.data === undefined,
		onRetry: playersQuery.refetch,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		create: (values: PlayerFormValues) => createMutation.mutateAsync(values),
		update: (values: PlayerFormValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		delete: (id: string) => {
			deleteMutation.mutate(id);
		},
		createTag,
	};
}
