import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/utils/trpc";

export function useTransactionTypeManager() {
	const queryClient = useQueryClient();
	const typeListKey = trpc.transactionType.list.queryOptions().queryKey;

	const typesQuery = useQuery(trpc.transactionType.list.queryOptions());
	const types = typesQuery.data ?? [];

	const updateMutation = useMutation({
		mutationFn: ({ id, name }: { id: string; name: string }) =>
			trpcClient.transactionType.update.mutate({ id, name }),
		onMutate: async ({ id, name }) => {
			await queryClient.cancelQueries({ queryKey: typeListKey });
			const previous = queryClient.getQueryData(typeListKey);
			queryClient.setQueryData(typeListKey, (old) =>
				old?.map((t) => (t.id === id ? { ...t, name } : t))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(typeListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: typeListKey });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.transactionType.delete.mutate({ id }),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: typeListKey });
		},
	});

	return {
		types,
		update: (params: { id: string; name: string }) =>
			updateMutation.mutateAsync(params),
		delete: (id: string) => deleteMutation.mutateAsync(id),
		isUpdatePending: updateMutation.isPending,
		isDeletePending: deleteMutation.isPending,
	};
}
