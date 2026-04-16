import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PlayerFormValues } from "@/players/components/player-form";
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
		queryClient.invalidateQueries({
			queryKey: trpc.playerTag.list.queryOptions().queryKey,
		});
		return { id: created.id, name: created.name, color: created.color };
	};

	const createMutation = useMutation({
		mutationFn: (values: PlayerFormValues) =>
			trpcClient.player.create.mutate({
				...values,
				memo: values.memo ?? undefined,
			}),
		onMutate: async (newPlayer) => {
			await queryClient.cancelQueries({ queryKey: playerListKey });
			const previous = queryClient.getQueryData(playerListKey);
			queryClient.setQueryData(
				playerListKey,
				(old: PlayerItem[] | undefined) => {
					if (!old) {
						return old;
					}
					const newTags = newPlayer.tagIds
						? availableTags.filter((t) => newPlayer.tagIds?.includes(t.id))
						: [];
					return [
						...old,
						{
							id: `temp-${Date.now()}`,
							isTemporary: false,
							name: newPlayer.name,
							memo: newPlayer.memo ?? null,
							tags: newTags,
							createdAt: new Date().toISOString(),
							updatedAt: new Date().toISOString(),
							userId: "",
						},
					];
				}
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playerListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: playerListKey });
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: PlayerFormValues & { id: string }) =>
			trpcClient.player.update.mutate(values),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({ queryKey: playerListKey });
			const previous = queryClient.getQueryData(playerListKey);
			queryClient.setQueryData(
				playerListKey,
				(old: PlayerItem[] | undefined) => {
					if (!old) {
						return old;
					}
					return old.map((p) => {
						if (p.id !== updated.id) {
							return p;
						}
						const newTags = updated.tagIds
							? availableTags.filter((t) => updated.tagIds?.includes(t.id))
							: p.tags;
						return {
							...p,
							name: updated.name,
							memo: updated.memo ?? p.memo,
							tags: newTags,
						};
					});
				}
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playerListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: playerListKey });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.player.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: playerListKey });
			const previous = queryClient.getQueryData(playerListKey);
			queryClient.setQueryData(playerListKey, (old: PlayerItem[] | undefined) =>
				old?.filter((p) => p.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(playerListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: playerListKey });
		},
	});

	return {
		players,
		availableTags,
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
