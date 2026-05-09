import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface RingGameBlindSet {
	ante: number | null;
	anteType: string | null;
	blind1: number;
	blind2: number;
	blind3: number | null;
	blind4: number | null;
	id: number;
	limitFormatId: number;
	ringGameId: string;
	sortOrder: number;
}

export interface RingGame {
	archivedAt: string | null;
	blindSets: RingGameBlindSet[];
	createdAt: string;
	currencyId: string | null;
	id: string;
	maxBuyIn: number | null;
	memo: string | null;
	minBuyIn: number | null;
	name: string;
	storeId: string | null;
	tableSize: number | null;
	updatedAt: string;
	variantId: number | null;
}

export interface RingGameFormValues {
	ante?: number;
	anteType?: "all" | "bb" | "none";
	blind1?: number;
	blind2?: number;
	blind3?: number;
	currencyId?: string;
	maxBuyIn?: number;
	memo?: string;
	minBuyIn?: number;
	name: string;
	tableSize?: number;
	variant?: string;
	variantId?: number;
}

function buildOptimisticRingGame(
	storeId: string,
	values: RingGameFormValues,
	id: string
): RingGame {
	return {
		archivedAt: null,
		blindSets: [],
		currencyId: values.currencyId ?? null,
		id,
		maxBuyIn: values.maxBuyIn ?? null,
		memo: values.memo ?? null,
		minBuyIn: values.minBuyIn ?? null,
		name: values.name,
		storeId,
		tableSize: values.tableSize ?? null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		variantId: values.variantId ?? null,
	};
}

interface UseRingGamesOptions {
	showArchived: boolean;
	storeId: string;
}

export function useRingGames({ storeId, showArchived }: UseRingGamesOptions) {
	const queryClient = useQueryClient();

	const activeQueryOptions = trpc.ringGame.listByStore.queryOptions({
		storeId,
		includeArchived: false,
	});
	const archivedQueryOptions = trpc.ringGame.listByStore.queryOptions({
		storeId,
		includeArchived: true,
	});

	const activeQuery = useQuery(activeQueryOptions);
	const activeGames = activeQuery.data ?? [];

	const archivedQuery = useQuery({
		...archivedQueryOptions,
		enabled: showArchived,
	});
	const archivedGames = archivedQuery.data ?? [];

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const invalidateBoth = () => {
		invalidateTargets(queryClient, [
			{ queryKey: activeQueryOptions.queryKey },
			{ queryKey: archivedQueryOptions.queryKey },
		]);
	};

	const createMutation = useMutation({
		mutationFn: (values: RingGameFormValues) =>
			trpcClient.ringGame.create.mutate({
				storeId,
				name: values.name,
				variantId: values.variantId,
				minBuyIn: values.minBuyIn,
				maxBuyIn: values.maxBuyIn,
				tableSize: values.tableSize,
				currencyId: values.currencyId,
				memo: values.memo,
			}),
		onMutate: async (values) => {
			await cancelTargets(queryClient, [
				{ queryKey: activeQueryOptions.queryKey },
				{ queryKey: archivedQueryOptions.queryKey },
			]);
			const previousActive = snapshotQuery(
				queryClient,
				activeQueryOptions.queryKey
			);
			const previousArchived = snapshotQuery(
				queryClient,
				archivedQueryOptions.queryKey
			);
			queryClient.setQueryData<RingGame[]>(
				activeQueryOptions.queryKey,
				(old) => [
					...(old ?? []),
					buildOptimisticRingGame(
						storeId,
						values,
						`temp-ring-game-${Date.now()}`
					),
				]
			);
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousActive,
				context?.previousArchived,
			]);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: activeQueryOptions.queryKey });
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: RingGameFormValues & { id: string }) =>
			trpcClient.ringGame.update.mutate({
				id: values.id,
				name: values.name,
				variantId: values.variantId,
				minBuyIn: values.minBuyIn ?? null,
				maxBuyIn: values.maxBuyIn ?? null,
				tableSize: values.tableSize ?? null,
				currencyId: values.currencyId ?? null,
				memo: values.memo ?? null,
			}),
		onMutate: async (values) => {
			await cancelTargets(queryClient, [
				{ queryKey: activeQueryOptions.queryKey },
				{ queryKey: archivedQueryOptions.queryKey },
			]);
			const previousActive = snapshotQuery(
				queryClient,
				activeQueryOptions.queryKey
			);
			const previousArchived = snapshotQuery(
				queryClient,
				archivedQueryOptions.queryKey
			);
			const applyUpdate = (games: RingGame[] | undefined) =>
				games?.map((game) =>
					game.id === values.id
						? {
								...game,
								...buildOptimisticRingGame(storeId, values, values.id),
							}
						: game
				) ?? [];
			queryClient.setQueryData(activeQueryOptions.queryKey, applyUpdate);
			queryClient.setQueryData(archivedQueryOptions.queryKey, applyUpdate);
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousActive,
				context?.previousArchived,
			]);
		},
		onSettled: invalidateBoth,
	});

	const archiveMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.archive.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: activeQueryOptions.queryKey },
				{ queryKey: archivedQueryOptions.queryKey },
			]);
			const previousActive = snapshotQuery(
				queryClient,
				activeQueryOptions.queryKey
			);
			const previousArchived = snapshotQuery(
				queryClient,
				archivedQueryOptions.queryKey
			);
			const now = new Date().toISOString();
			const archivedGame = (
				previousActive.data as RingGame[] | undefined
			)?.find((game) => game.id === id);
			queryClient.setQueryData<RingGame[]>(
				activeQueryOptions.queryKey,
				(old) => old?.filter((game) => game.id !== id) ?? []
			);
			if (archivedGame) {
				queryClient.setQueryData<RingGame[]>(
					archivedQueryOptions.queryKey,
					(old) => [...(old ?? []), { ...archivedGame, archivedAt: now }]
				);
			}
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousActive,
				context?.previousArchived,
			]);
		},
		onSettled: invalidateBoth,
	});

	const restoreMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.restore.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: activeQueryOptions.queryKey },
				{ queryKey: archivedQueryOptions.queryKey },
			]);
			const previousActive = snapshotQuery(
				queryClient,
				activeQueryOptions.queryKey
			);
			const previousArchived = snapshotQuery(
				queryClient,
				archivedQueryOptions.queryKey
			);
			const restoredGame = (
				previousArchived.data as RingGame[] | undefined
			)?.find((game) => game.id === id);
			queryClient.setQueryData<RingGame[]>(
				archivedQueryOptions.queryKey,
				(old) => old?.filter((game) => game.id !== id) ?? []
			);
			if (restoredGame) {
				queryClient.setQueryData<RingGame[]>(
					activeQueryOptions.queryKey,
					(old) => [...(old ?? []), { ...restoredGame, archivedAt: null }]
				);
			}
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousActive,
				context?.previousArchived,
			]);
		},
		onSettled: invalidateBoth,
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.ringGame.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: activeQueryOptions.queryKey },
				{ queryKey: archivedQueryOptions.queryKey },
			]);
			const previousActive = snapshotQuery(
				queryClient,
				activeQueryOptions.queryKey
			);
			const previousArchived = snapshotQuery(
				queryClient,
				archivedQueryOptions.queryKey
			);
			queryClient.setQueryData<RingGame[]>(
				activeQueryOptions.queryKey,
				(old) => old?.filter((game) => game.id !== id) ?? []
			);
			queryClient.setQueryData<RingGame[]>(
				archivedQueryOptions.queryKey,
				(old) => old?.filter((game) => game.id !== id) ?? []
			);
			return { previousActive, previousArchived };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousActive,
				context?.previousArchived,
			]);
		},
		onSettled: invalidateBoth,
	});

	return {
		activeGames,
		archivedGames,
		currencies,
		activeLoading: activeQuery.isLoading,
		archivedLoading: archivedQuery.isLoading,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		create: (values: RingGameFormValues) => createMutation.mutateAsync(values),
		update: (values: RingGameFormValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		archive: (id: string) => archiveMutation.mutate(id),
		restore: (id: string) => restoreMutation.mutate(id),
		delete: (id: string) => deleteMutation.mutate(id),
	};
}
