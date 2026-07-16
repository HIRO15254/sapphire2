import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";

export type { ItemTransaction } from "@/features/items/utils/types";

import type { ItemTransaction } from "@/features/items/utils/types";
import {
	cancelTargets,
	createOptimisticId,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
	updateInfiniteQueryItems,
	updateQueryItems,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface ItemValues {
	currencyId: string;
	description?: string | null;
	name: string;
	unitValue: number;
}

export interface ItemTransactionValues {
	count: number;
	memo?: string;
	transactedAt: string;
}

export interface ItemWithHoldings {
	createdAt: Date | string;
	currencyId: string;
	currencyName?: string | null;
	currencyUnit?: string | null;
	description?: string | null;
	holdings: number;
	id: string;
	name: string;
	unitValue: number;
	updatedAt?: Date | string;
}

// `expandedItemId` defaults to null so list-only consumers (e.g. the live
// session views' virtual buy-in item pickers) can call `useItems()` bare.
export function useItems(expandedItemId: string | null = null) {
	const queryClient = useQueryClient();
	const itemListKey = trpc.item.list.queryOptions().queryKey;

	const itemsQuery = useQuery(trpc.item.list.queryOptions());
	const items = itemsQuery.data ?? [];

	// All loaded pages live in a single infinite-query cache entry. A refetch
	// (focus / reconnect / staleTime / invalidate / remount) re-fetches every
	// loaded page, so load-more results never roll back to page 1.
	const transactionsInfiniteOptions =
		trpc.itemTransaction.listByItem.infiniteQueryOptions(
			{ itemId: expandedItemId ?? "" },
			{
				enabled: expandedItemId !== null,
				getNextPageParam: (lastPage) => lastPage.nextCursor,
			}
		);

	const transactionsQuery = useInfiniteQuery(transactionsInfiniteOptions);
	const transactionsKey = transactionsInfiniteOptions.queryKey;

	const allTransactions: ItemTransaction[] =
		transactionsQuery.data?.pages.flatMap((page) => page.items) ?? [];

	const createMutation = useMutation({
		mutationFn: (values: ItemValues) => trpcClient.item.create.mutate(values),
		onMutate: async (newItem) => {
			await cancelTargets(queryClient, [{ queryKey: itemListKey }]);
			const previous = snapshotQuery(queryClient, itemListKey);
			updateQueryItems<ItemWithHoldings>(queryClient, itemListKey, (old) => {
				const base = old[0];
				if (!base) {
					return old;
				}
				// currencyName / currencyUnit are joined server-side; the temp row
				// leaves them null and the onSettled refetch fills them in.
				return [
					...old,
					{
						...base,
						id: createOptimisticId("temp"),
						name: newItem.name,
						currencyId: newItem.currencyId,
						currencyName: null,
						currencyUnit: null,
						unitValue: newItem.unitValue,
						description: newItem.description ?? null,
						holdings: 0,
						createdAt: new Date().toISOString(),
					},
				];
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: itemListKey }]);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: ItemValues & { id: string }) =>
			trpcClient.item.update.mutate({
				id: values.id,
				name: values.name,
				currencyId: values.currencyId,
				unitValue: values.unitValue,
				description: values.description,
			}),
		onMutate: async (updated) => {
			await cancelTargets(queryClient, [{ queryKey: itemListKey }]);
			const previous = snapshotQuery(queryClient, itemListKey);
			updateQueryItems<ItemWithHoldings>(queryClient, itemListKey, (old) =>
				old.map((i) => (i.id === updated.id ? { ...i, ...updated } : i))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: itemListKey }]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.item.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: itemListKey }]);
			const previous = snapshotQuery(queryClient, itemListKey);
			updateQueryItems<ItemWithHoldings>(queryClient, itemListKey, (old) =>
				old.filter((i) => i.id !== id)
			);
			return { previous };
		},
		// The server rejects with CONFLICT while the item still has ledger
		// transactions — the rollback restores the optimistically removed row.
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: itemListKey }]);
		},
	});

	const addTransactionMutation = useMutation({
		mutationFn: (values: ItemTransactionValues & { itemId: string }) =>
			trpcClient.itemTransaction.create.mutate(values),
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: itemListKey },
				{ queryKey: transactionsKey },
			]);
		},
	});

	const editTransactionMutation = useMutation({
		mutationFn: (values: {
			count: number;
			id: string;
			memo: string | null;
			transactedAt: string;
		}) =>
			trpcClient.itemTransaction.update.mutate({
				id: values.id,
				count: values.count,
				transactedAt: values.transactedAt,
				memo: values.memo,
			}),
		onMutate: async (values) => {
			// Optimistic update against the infinite cache so the edit survives
			// the trailing invalidation's refetch (and any focus / reconnect /
			// staleTime refetch).
			await cancelTargets(queryClient, [{ queryKey: transactionsKey }]);
			const previous = snapshotQuery(queryClient, transactionsKey);
			updateInfiniteQueryItems<ItemTransaction>(
				queryClient,
				transactionsKey,
				(txItems) =>
					txItems.map((t) =>
						t.id === values.id
							? {
									...t,
									count: values.count,
									memo: values.memo,
									transactedAt: values.transactedAt,
								}
							: t
					)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: itemListKey },
				{ queryKey: transactionsKey },
			]);
		},
	});

	const deleteTransactionMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.itemTransaction.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: transactionsKey }]);
			const previous = snapshotQuery(queryClient, transactionsKey);
			updateInfiniteQueryItems<ItemTransaction>(
				queryClient,
				transactionsKey,
				(txItems) => txItems.filter((t) => t.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: itemListKey },
				{ queryKey: transactionsKey },
			]);
		},
	});

	// Load-more wrapper keeps the button's click event out of
	// `FetchNextPageOptions`, and the guard makes it a no-op when there is no
	// next page (otherwise React Query would re-fetch page 1) or while a page
	// is already in flight.
	const fetchNextPage = () => {
		if (
			transactionsQuery.hasNextPage &&
			!transactionsQuery.isFetchingNextPage
		) {
			transactionsQuery.fetchNextPage();
		}
	};

	return {
		items,
		isLoading: itemsQuery.isLoading,
		isError: itemsQuery.isError,
		isInitialLoadError: itemsQuery.isError && itemsQuery.data === undefined,
		retry: itemsQuery.refetch,
		onRetry: itemsQuery.refetch,
		allTransactions,
		isTransactionsLoading: transactionsQuery.isLoading,
		isTransactionsInitialLoadError:
			transactionsQuery.isError && transactionsQuery.data === undefined,
		onRetryTransactions: transactionsQuery.refetch,
		hasNextPage: transactionsQuery.hasNextPage,
		isFetchingNextPage: transactionsQuery.isFetchingNextPage,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		isAddTransactionPending: addTransactionMutation.isPending,
		isEditTransactionPending: editTransactionMutation.isPending,
		create: (values: ItemValues) => createMutation.mutateAsync(values),
		update: (values: ItemValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		delete: (id: string) => deleteMutation.mutateAsync(id),
		addTransaction: (values: ItemTransactionValues & { itemId: string }) =>
			addTransactionMutation.mutateAsync(values),
		editTransaction: (values: {
			count: number;
			id: string;
			memo: string | null;
			transactedAt: string;
		}) => editTransactionMutation.mutateAsync(values),
		deleteTransaction: (id: string) => {
			deleteTransactionMutation.mutate(id);
		},
		fetchNextPage,
	};
}
