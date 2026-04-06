import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { trpc, trpcClient } from "@/utils/trpc"

export interface CurrencyValues {
	name: string
	unit?: string
}

export interface TransactionValues {
	amount: number
	memo?: string
	transactedAt: string
	transactionTypeId: string
}

export interface CurrencyItem {
	id: string
	name: string
	unit?: string | null
}

export interface Transaction {
	amount: number
	createdAt?: Date | string
	currencyId?: string
	id: string
	memo?: string | null
	transactedAt: Date | string
	transactionTypeId?: string
	transactionTypeName: string
}

export function useCurrencies(expandedCurrencyId: string | null) {
	const [allTransactions, setAllTransactions] = useState<Transaction[]>([])
	const [txCursor, setTxCursor] = useState<string | undefined>(undefined)
	const [txHasMore, setTxHasMore] = useState(false)
	const [isLoadingMore, setIsLoadingMore] = useState(false)

	const queryClient = useQueryClient()
	const currencyListKey = trpc.currency.list.queryOptions().queryKey

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions())
	const currencies = currenciesQuery.data ?? []

	const transactionsQueryOptions =
		trpc.currencyTransaction.listByCurrency.queryOptions(
			{ currencyId: expandedCurrencyId ?? "" },
			{ enabled: expandedCurrencyId !== null }
		)

	const transactionsQuery = useQuery(transactionsQueryOptions)

	useEffect(() => {
		if (transactionsQuery.data) {
			setAllTransactions(transactionsQuery.data.items)
			setTxCursor(transactionsQuery.data.nextCursor)
			setTxHasMore(transactionsQuery.data.nextCursor !== undefined)
		}
	}, [transactionsQuery.data])

	const resetTransactionState = () => {
		setAllTransactions([])
		setTxCursor(undefined)
		setTxHasMore(false)
		setIsLoadingMore(false)
	}

	const createMutation = useMutation({
		mutationFn: (values: CurrencyValues) =>
			trpcClient.currency.create.mutate(values),
		onMutate: async (newCurrency) => {
			await queryClient.cancelQueries({ queryKey: currencyListKey })
			const previous = queryClient.getQueryData(currencyListKey)
			queryClient.setQueryData(currencyListKey, (old) => {
				if (!old) {
					return old
				}
				const base = old[0]
				return [
					...old,
					{
						...base,
						id: `temp-${Date.now()}`,
						name: newCurrency.name,
						unit: newCurrency.unit ?? null,
						balance: 0,
					},
				]
			})
			return { previous }
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(currencyListKey, context.previous)
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey })
		},
	})

	const updateMutation = useMutation({
		mutationFn: (values: CurrencyValues & { id: string }) =>
			trpcClient.currency.update.mutate(values),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({ queryKey: currencyListKey })
			const previous = queryClient.getQueryData(currencyListKey)
			queryClient.setQueryData(currencyListKey, (old) =>
				old?.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
			)
			return { previous }
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(currencyListKey, context.previous)
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey })
		},
	})

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.currency.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: currencyListKey })
			const previous = queryClient.getQueryData(currencyListKey)
			queryClient.setQueryData(currencyListKey, (old) =>
				old?.filter((c) => c.id !== id)
			)
			return { previous }
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(currencyListKey, context.previous)
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey })
		},
	})

	const addTransactionMutation = useMutation({
		mutationFn: (values: TransactionValues & { currencyId: string }) =>
			trpcClient.currencyTransaction.create.mutate(values),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey })
			queryClient.invalidateQueries({
				queryKey: transactionsQueryOptions.queryKey,
			})
		},
		onSuccess: () => {
			resetTransactionState()
		},
	})

	const editTransactionMutation = useMutation({
		mutationFn: (values: {
			amount: number
			id: string
			memo: string | null
			transactedAt: string
			transactionTypeId: string
		}) =>
			trpcClient.currencyTransaction.update.mutate({
				id: values.id,
				transactionTypeId: values.transactionTypeId,
				amount: values.amount,
				transactedAt: values.transactedAt,
				memo: values.memo,
			}),
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey })
			queryClient.invalidateQueries({
				queryKey: transactionsQueryOptions.queryKey,
			})
		},
		onSuccess: () => {
			resetTransactionState()
		},
	})

	const deleteTransactionMutation = useMutation({
		mutationFn: (id: string) =>
			trpcClient.currencyTransaction.delete.mutate({ id }),
		onMutate: (id) => {
			const previous = allTransactions
			setAllTransactions((prev) => prev.filter((t) => t.id !== id))
			return { previous }
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				setAllTransactions(context.previous)
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: currencyListKey })
			queryClient.invalidateQueries({
				queryKey: transactionsQueryOptions.queryKey,
			})
		},
		onSuccess: () => {
			resetTransactionState()
		},
	})

	const handleLoadMore = async () => {
		if (!(expandedCurrencyId && txCursor) || isLoadingMore) {
			return
		}
		setIsLoadingMore(true)
		try {
			const result = await trpcClient.currencyTransaction.listByCurrency.query({
				currencyId: expandedCurrencyId,
				cursor: txCursor,
			})
			setAllTransactions((prev) => [...prev, ...result.items])
			setTxCursor(result.nextCursor)
			setTxHasMore(result.nextCursor !== undefined)
		} finally {
			setIsLoadingMore(false)
		}
	}

	return {
		currencies,
		allTransactions,
		txHasMore,
		isLoadingMore,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		isAddTransactionPending: addTransactionMutation.isPending,
		isEditTransactionPending: editTransactionMutation.isPending,
		resetTransactionState,
		create: (values: CurrencyValues) => createMutation.mutateAsync(values),
		update: (values: CurrencyValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		delete: (id: string) => deleteMutation.mutateAsync(id),
		addTransaction: (values: TransactionValues & { currencyId: string }) =>
			addTransactionMutation.mutateAsync(values),
		editTransaction: (values: {
			amount: number
			id: string
			memo: string | null
			transactedAt: string
			transactionTypeId: string
		}) => editTransactionMutation.mutateAsync(values),
		deleteTransaction: (id: string) => {
			deleteTransactionMutation.mutate(id)
		},
		handleLoadMore,
	}
}
