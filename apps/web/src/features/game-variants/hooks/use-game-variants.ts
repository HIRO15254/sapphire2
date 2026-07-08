import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
	updateQueryItems,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface GameVariant {
	archivedAt: Date | null;
	blindLabel1: string | null;
	blindLabel2: string | null;
	blindLabel3: string | null;
	id: string;
	name: string;
	sortOrder: number;
}

export interface GameVariantValues {
	blindLabel1?: string | null;
	blindLabel2?: string | null;
	blindLabel3?: string | null;
	name: string;
}

export function useGameVariants(options?: { includeArchived?: boolean }) {
	const queryClient = useQueryClient();
	const includeArchived = options?.includeArchived ?? false;

	const listQueryOptions = trpc.gameVariant.list.queryOptions({
		includeArchived,
	});
	const listKey = listQueryOptions.queryKey;

	const variantsQuery = useQuery(listQueryOptions);
	const variants = variantsQuery.data ?? [];

	const createMutation = useMutation({
		mutationFn: (values: GameVariantValues) =>
			trpcClient.gameVariant.create.mutate(values),
		onMutate: async (values) => {
			await cancelTargets(queryClient, [{ queryKey: listKey }]);
			const previous = snapshotQuery(queryClient, listKey);
			updateQueryItems<GameVariant>(queryClient, listKey, (items) => [
				...items,
				{
					id: `temp-${Date.now()}`,
					name: values.name,
					blindLabel1: values.blindLabel1 ?? null,
					blindLabel2: values.blindLabel2 ?? null,
					blindLabel3: values.blindLabel3 ?? null,
					sortOrder: items.length,
					archivedAt: null,
				},
			]);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: listKey }]);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: GameVariantValues & { id: string }) =>
			trpcClient.gameVariant.update.mutate(values),
		onMutate: async (updated) => {
			await cancelTargets(queryClient, [{ queryKey: listKey }]);
			const previous = snapshotQuery(queryClient, listKey);
			updateQueryItems<GameVariant>(queryClient, listKey, (items) =>
				items.map((v) => (v.id === updated.id ? { ...v, ...updated } : v))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: listKey }]);
		},
	});

	const archiveMutation = useMutation({
		mutationFn: (id: string) => trpcClient.gameVariant.archive.mutate({ id }),
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: listKey }]);
		},
	});

	const restoreMutation = useMutation({
		mutationFn: (id: string) => trpcClient.gameVariant.restore.mutate({ id }),
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: listKey }]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.gameVariant.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: listKey }]);
			const previous = snapshotQuery(queryClient, listKey);
			updateQueryItems<GameVariant>(queryClient, listKey, (items) =>
				items.filter((v) => v.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: listKey }]);
		},
	});

	return {
		variants,
		isPending: variantsQuery.isPending,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		isArchivePending: archiveMutation.isPending,
		isRestorePending: restoreMutation.isPending,
		isDeletePending: deleteMutation.isPending,
		onCreate: (values: GameVariantValues) => createMutation.mutateAsync(values),
		onUpdate: (values: GameVariantValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		onArchive: (id: string) => archiveMutation.mutateAsync(id),
		onRestore: (id: string) => restoreMutation.mutateAsync(id),
		onDelete: (id: string) => deleteMutation.mutateAsync(id),
	};
}
