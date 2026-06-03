import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
	updateInfiniteQueryItems,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface CurrencyValues {
	description?: string | null;
	name: string;
	unit?: string;
}

export interface TransactionValues {
	amount: number;
	memo?: string;
	transactedAt: string;
	transactionTypeId: string;
}

export interface CurrencyItem {
	createdAt: Date | string;
	description?: string | null;
	id: string;
	isFavorite: boolean;
	name: string;
	unit?: string | null;
}

export interface Transaction {
	amount: number;
	createdAt?: Date | string;
	currencyId?: string;
	id: string;
	memo?: string | null;
	transactedAt: Date | string;
	transactionTypeId?: string;
	transactionTypeName: string;
}

export function useCurrencies(expandedCurrencyId: string | null) {
	const queryClient = useQueryClient();
	const currencyListKey = trpc.currency.list.queryOptions().queryKey;

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	// All loaded pages live in a single infinite-query cache entry. A refetch
	// (focus / reconnect / staleTime / invalidate / remount) re-fetches every
	// loaded page, so load-more results never roll back to page 1.
	const transactionsInfiniteOptions =
		trpc.currencyTransaction.listByCurrency.infiniteQueryOptions(
			{ currencyId: expandedCurrencyId ?? "" },
			{
				enabled: expandedCurrencyId !== null,
				getNextPageParam: (lastPage) => lastPage.nextCursor,
			}
		);

	const transactionsQuery = useInfiniteQuery(transactionsInfiniteOptions);
	const transactionsKey = transactionsInfiniteOptions.queryKey;

	const allTransactions: Transaction[] =
		transactionsQuery.data?.pages.flatMap((page) => page.items) ?? [];

	const createMutation = useMutation({
		mutationFn: (values: CurrencyValues) =>
			trpcClient.currency.create.mutate(values),
		onMutate: async (newCurrency) => {
			await cancelTargets(queryClient, [{ queryKey: currencyListKey }]);
			const previous = snapshotQuery(queryClient, currencyListKey);
			queryClient.setQueryData(currencyListKey, (old) => {
				if (!old) {
					return old;
				}
				const base = old[0];
				return [
					...old,
					{
						...base,
						id: `temp-${Date.now()}`,
						name: newCurrency.name,
						unit: newCurrency.unit ?? null,
						description: newCurrency.description ?? null,
						isFavorite: false,
						createdAt: new Date().toISOString(),
						balance: 0,
					},
				];
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: currencyListKey }]);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: CurrencyValues & { id: string }) =>
			trpcClient.currency.update.mutate(values),
		onMutate: async (updated) => {
			await cancelTargets(queryClient, [{ queryKey: currencyListKey }]);
			const previous = snapshotQuery(queryClient, currencyListKey);
			queryClient.setQueryData(currencyListKey, (old) =>
				old?.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: currencyListKey }]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.currency.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: currencyListKey }]);
			const previous = snapshotQuery(queryClient, currencyListKey);
			queryClient.setQueryData(currencyListKey, (old) =>
				old?.filter((c) => c.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: currencyListKey }]);
		},
	});

	const addTransactionMutation = useMutation({
		mutationFn: (values: TransactionValues & { currencyId: string }) =>
			trpcClient.currencyTransaction.create.mutate(values),
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: currencyListKey },
				{ queryKey: transactionsKey },
			]);
		},
	});

	const editTransactionMutation = useMutation({
		mutationFn: (values: {
			amount: number;
			id: string;
			memo: string | null;
			transactedAt: string;
			transactionTypeId: string;
		}) =>
			trpcClient.currencyTransaction.update.mutate({
				id: values.id,
				transactionTypeId: values.transactionTypeId,
				amount: values.amount,
				transactedAt: values.transactedAt,
				memo: values.memo,
			}),
		onMutate: async (values) => {
			// Optimistic update against the infinite cache so the edit survives
			// the trailing invalidation's refetch (and any focus / reconnect /
			// staleTime refetch). The refetch is when the (possibly changed)
			// transactionTypeName catches up; until then the stale name stays.
			await cancelTargets(queryClient, [{ queryKey: transactionsKey }]);
			const previous = snapshotQuery(queryClient, transactionsKey);
			updateInfiniteQueryItems<Transaction>(
				queryClient,
				transactionsKey,
				(items) =>
					items.map((t) =>
						t.id === values.id
							? {
									...t,
									amount: values.amount,
									memo: values.memo,
									transactedAt: values.transactedAt,
									transactionTypeId: values.transactionTypeId,
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
				{ queryKey: currencyListKey },
				{ queryKey: transactionsKey },
			]);
		},
	});

	const deleteTransactionMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.currencyTransaction.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: transactionsKey }]);
			const previous = snapshotQuery(queryClient, transactionsKey);
			updateInfiniteQueryItems<Transaction>(
				queryClient,
				transactionsKey,
				(items) => items.filter((t) => t.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: currencyListKey },
				{ queryKey: transactionsKey },
			]);
		},
	});

	const toggleFavoriteMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.currency.toggleFavorite.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: currencyListKey }]);
			const previous = snapshotQuery(queryClient, currencyListKey);
			queryClient.setQueryData(currencyListKey, (old) => {
				if (!old) {
					return old;
				}
				const toggled = old.map((c) =>
					c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
				);
				// Exact replica of server ORDER BY is_favorite DESC, created_at ASC.
				return [...toggled].sort((a, b) => {
					if (a.isFavorite !== b.isFavorite) {
						return a.isFavorite ? -1 : 1;
					}
					return (
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
					);
				});
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: currencyListKey }]);
		},
	});

	// Load-more is now `fetchNextPage`. The zero-arg wrapper keeps the button's
	// click event out of `FetchNextPageOptions`, and the guard makes it a no-op
	// when there is no next page (otherwise React Query would re-fetch page 1)
	// or while a page is already in flight.
	const fetchNextPage = () => {
		if (
			transactionsQuery.hasNextPage &&
			!transactionsQuery.isFetchingNextPage
		) {
			transactionsQuery.fetchNextPage();
		}
	};

	return {
		currencies,
		isLoading: currenciesQuery.isLoading,
		allTransactions,
		hasNextPage: transactionsQuery.hasNextPage,
		isFetchingNextPage: transactionsQuery.isFetchingNextPage,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		isAddTransactionPending: addTransactionMutation.isPending,
		isEditTransactionPending: editTransactionMutation.isPending,
		isToggleFavoritePending: toggleFavoriteMutation.isPending,
		create: (values: CurrencyValues) => createMutation.mutateAsync(values),
		update: (values: CurrencyValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		delete: (id: string) => deleteMutation.mutateAsync(id),
		addTransaction: (values: TransactionValues & { currencyId: string }) =>
			addTransactionMutation.mutateAsync(values),
		editTransaction: (values: {
			amount: number;
			id: string;
			memo: string | null;
			transactedAt: string;
			transactionTypeId: string;
		}) => editTransactionMutation.mutateAsync(values),
		deleteTransaction: (id: string) => {
			deleteTransactionMutation.mutate(id);
		},
		toggleFavorite: (id: string) => toggleFavoriteMutation.mutateAsync(id),
		fetchNextPage,
	};
}
