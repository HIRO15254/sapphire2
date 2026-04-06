import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type TagColor } from "@/players/constants/player-tag-colors";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQueries,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface TagFormValues {
	color: TagColor;
	name: string;
}

export interface TagItem {
	color: string;
	id: string;
	name: string;
}

export function usePlayerTags() {
	const queryClient = useQueryClient();
	const tagListKey = trpc.playerTag.list.queryOptions().queryKey;
	const playerListKey = trpc.player.list.queryOptions().queryKey;

	const tagsQuery = useQuery(trpc.playerTag.list.queryOptions());
	const tags = (tagsQuery.data ?? []) as TagItem[];

	const createMutation = useMutation({
		mutationFn: (values: TagFormValues) =>
			trpcClient.playerTag.create.mutate(values),
		onMutate: async (newTag) => {
			await cancelTargets(queryClient, [{ queryKey: tagListKey }]);
			const previous = snapshotQuery(queryClient, tagListKey);
			queryClient.setQueryData<
				Array<{
					color: string;
					createdAt?: string;
					id: string;
					name: string;
					updatedAt?: string;
					userId?: string;
				}>
			>(tagListKey, (old) => [
				...(old ?? []),
				{
					id: `temp-tag-${Date.now()}`,
					name: newTag.name,
					color: newTag.color,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
					userId: "",
				},
			]);
			return { previous };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: tagListKey }]);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: TagFormValues & { id: string }) =>
			trpcClient.playerTag.update.mutate(values),
		onMutate: async (updated) => {
			await cancelTargets(queryClient, [
				{ queryKey: tagListKey },
				{ filters: { queryKey: playerListKey } },
			]);
			const previousTags = snapshotQuery(queryClient, tagListKey);
			const previousPlayers = snapshotQueries(queryClient, {
				queryKey: playerListKey,
			});
			queryClient.setQueryData<TagItem[]>(
				tagListKey,
				(old) =>
					old?.map((tag) =>
						tag.id === updated.id
							? { ...tag, name: updated.name, color: updated.color }
							: tag
					) ?? []
			);
			queryClient.setQueriesData<Array<{ tags: TagItem[] }>>(
				{ queryKey: playerListKey },
				(old) =>
					old?.map((player) => ({
						...player,
						tags: player.tags.map((tag) =>
							tag.id === updated.id
								? { ...tag, name: updated.name, color: updated.color }
								: tag
						),
					}))
			);
			return { previousPlayers, previousTags };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousTags,
				context?.previousPlayers,
			]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: tagListKey },
				{ filters: { queryKey: playerListKey } },
			]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.playerTag.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: tagListKey },
				{ filters: { queryKey: playerListKey } },
			]);
			const previousTags = snapshotQuery(queryClient, tagListKey);
			const previousPlayers = snapshotQueries(queryClient, {
				queryKey: playerListKey,
			});
			queryClient.setQueryData<TagItem[]>(
				tagListKey,
				(old) => old?.filter((tag) => tag.id !== id) ?? []
			);
			queryClient.setQueriesData<Array<{ tags: TagItem[] }>>(
				{ queryKey: playerListKey },
				(old) =>
					old?.map((player) => ({
						...player,
						tags: player.tags.filter((tag) => tag.id !== id),
					}))
			);
			return { previousPlayers, previousTags };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousTags,
				context?.previousPlayers,
			]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: tagListKey },
				{ filters: { queryKey: playerListKey } },
			]);
		},
	});

	return {
		tags,
		create: (values: TagFormValues) => createMutation.mutateAsync(values),
		update: (values: TagFormValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		delete: (id: string) => deleteMutation.mutateAsync(id),
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		isDeletePending: deleteMutation.isPending,
	};
}
