import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export function useTransactionTypes() {
	const queryClient = useQueryClient();
	const typeListKey = trpc.transactionType.list.queryOptions().queryKey;

	const typesQuery = useQuery(trpc.transactionType.list.queryOptions());
	const types = typesQuery.data ?? [];

	const createTypeMutation = useMutation({
		mutationFn: (name: string) =>
			trpcClient.transactionType.create.mutate({ name }),
		onMutate: async (name) => {
			await cancelTargets(queryClient, [{ queryKey: typeListKey }]);
			const previous = snapshotQuery(queryClient, typeListKey);
			queryClient.setQueryData<
				Array<{
					createdAt?: string;
					id: string;
					name: string;
					updatedAt?: string;
					userId?: string;
				}>
			>(typeListKey, (old) => [
				...(old ?? []),
				{
					createdAt: new Date().toISOString(),
					id: `temp-type-${Date.now()}`,
					name,
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
			invalidateTargets(queryClient, [{ queryKey: typeListKey }]);
		},
	});

	return {
		types,
		createType: (name: string) => createTypeMutation.mutateAsync(name),
		isCreatingType: createTypeMutation.isPending,
	};
}
