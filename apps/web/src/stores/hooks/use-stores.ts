import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/utils/trpc";

export interface StoreValues {
	memo?: string;
	name: string;
}

export interface StoreItem {
	id: string;
	memo?: string | null;
	name: string;
}

export function useStores() {
	const queryClient = useQueryClient();
	const storeListKey = trpc.store.list.queryOptions().queryKey;

	const storesQuery = useQuery(trpc.store.list.queryOptions());
	const stores = storesQuery.data ?? [];

	const createMutation = useMutation({
		mutationFn: (values: StoreValues) => trpcClient.store.create.mutate(values),
		onMutate: async (newStore) => {
			await queryClient.cancelQueries({ queryKey: storeListKey });
			const previous = queryClient.getQueryData(storeListKey);
			queryClient.setQueryData(storeListKey, (old) => {
				if (!old) {
					return old;
				}
				const base = old[0];
				return [
					...old,
					{
						...base,
						id: `temp-${Date.now()}`,
						name: newStore.name,
						memo: newStore.memo ?? null,
					},
				];
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(storeListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: storeListKey });
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: StoreValues & { id: string }) =>
			trpcClient.store.update.mutate(values),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({ queryKey: storeListKey });
			const previous = queryClient.getQueryData(storeListKey);
			queryClient.setQueryData(storeListKey, (old) =>
				old?.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(storeListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: storeListKey });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.store.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: storeListKey });
			const previous = queryClient.getQueryData(storeListKey);
			queryClient.setQueryData(storeListKey, (old) =>
				old?.filter((s) => s.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(storeListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: storeListKey });
		},
	});

	return {
		stores,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		create: (values: StoreValues) => createMutation.mutateAsync(values),
		update: (values: StoreValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		delete: (id: string) => {
			deleteMutation.mutate(id);
		},
	};
}
