import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface TransactionType {
	id: string;
	name: string;
}

export function useTransactionTypeManager() {
	const queryClient = useQueryClient();
	const typeListKey = trpc.transactionType.list.queryOptions().queryKey;

	const typesQuery = useQuery(trpc.transactionType.list.queryOptions());
	const types = (typesQuery.data ?? []) as TransactionType[];

	const createMutation = useMutation({
		mutationFn: (name: string) =>
			trpcClient.transactionType.create.mutate({ name }),
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: typeListKey }]);
		},
	});

	const updateMutation = useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			trpcClient.transactionType.update.mutate({ id, name }),
		onMutate: async ({ id, name }) => {
			await cancelTargets(queryClient, [{ queryKey: typeListKey }]);
			const previous = snapshotQuery(queryClient, typeListKey);
			queryClient.setQueryData<TransactionType[]>(
				typeListKey,
				(old) => old?.map((t) => (t.id === id ? { ...t, name } : t)) ?? []
			);
			return { previous };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: typeListKey }]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.transactionType.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: typeListKey }]);
			const previous = snapshotQuery(queryClient, typeListKey);
			queryClient.setQueryData<TransactionType[]>(
				typeListKey,
				(old) => old?.filter((t) => t.id !== id) ?? []
			);
			return { previous };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: typeListKey }]);
		},
	});

	return {
		types,
		create: (name: string) => createMutation.mutateAsync(name),
		update: (params: { id: string; name: string }) =>
			updateMutation.mutateAsync(params),
		delete: (id: string) => deleteMutation.mutateAsync(id),
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		isDeletePending: deleteMutation.isPending,
	};
}
