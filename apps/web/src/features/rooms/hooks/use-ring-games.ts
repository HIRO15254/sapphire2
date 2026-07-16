import type { MixGameGroup } from "@sapphire2/db/schemas/game";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	createOptimisticId,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
	updateQueryItems,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface RingGame {
	ante: number | null;
	anteType: string | null;
	archivedAt: string | null;
	blind1: number | null;
	blind2: number | null;
	blind3: number | null;
	createdAt: string;
	currencyId: string | null;
	id: string;
	maxBuyIn: number | null;
	memo: string | null;
	minBuyIn: number | null;
	mixGames: MixGameGroup[] | null;
	name: string;
	roomId: string | null;
	tableSize: number | null;
	updatedAt: string;
	userId: string | null;
	variant: string;
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
	mixGames?: MixGameGroup[] | null;
	name: string;
	tableSize?: number;
	variant: string;
}

function buildOptimisticRingGame(
	roomId: string,
	values: RingGameFormValues,
	id: string
): RingGame {
	return {
		ante: values.ante ?? null,
		anteType: values.anteType ?? "none",
		archivedAt: null,
		blind1: values.blind1 ?? null,
		blind2: values.blind2 ?? null,
		blind3: values.blind3 ?? null,
		currencyId: values.currencyId ?? null,
		id,
		maxBuyIn: values.maxBuyIn ?? null,
		memo: values.memo ?? null,
		minBuyIn: values.minBuyIn ?? null,
		mixGames: values.mixGames ?? null,
		name: values.name,
		roomId,
		tableSize: values.tableSize ?? null,
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
		// Optimistic placeholder; replaced by the server row (which carries the
		// real userId) on settle.
		userId: null,
		variant: values.variant,
	};
}

interface UseRingGamesOptions {
	roomId: string;
	showArchived: boolean;
}

export function useRingGames({ roomId, showArchived }: UseRingGamesOptions) {
	const queryClient = useQueryClient();

	const activeQueryOptions = trpc.ringGame.listByRoom.queryOptions({
		roomId,
		includeArchived: false,
	});
	const archivedQueryOptions = trpc.ringGame.listByRoom.queryOptions({
		roomId,
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
			trpcClient.ringGame.create.mutate({ roomId, ...values }),
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
			const optimisticRingGame = buildOptimisticRingGame(
				roomId,
				values,
				createOptimisticId("temp-ring-game")
			);
			updateQueryItems<RingGame>(
				queryClient,
				activeQueryOptions.queryKey,
				(items) => [...items, optimisticRingGame],
				[optimisticRingGame]
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

	const updateMutation = useMutation({
		// Map cleared (undefined) fields to explicit `null` so the server clears
		// them. The update procedure leaves `undefined` keys untouched, so a
		// JSON-dropped undefined would otherwise make "clear a field" a no-op.
		mutationFn: (values: RingGameFormValues & { id: string }) =>
			trpcClient.ringGame.update.mutate({
				id: values.id,
				name: values.name,
				variant: values.variant,
				mixGames: values.mixGames ?? null,
				blind1: values.blind1 ?? null,
				blind2: values.blind2 ?? null,
				blind3: values.blind3 ?? null,
				ante: values.ante ?? null,
				anteType: values.anteType ?? null,
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
								...buildOptimisticRingGame(roomId, values, values.id),
							}
						: game
				) ?? [];
			updateQueryItems<RingGame>(
				queryClient,
				activeQueryOptions.queryKey,
				applyUpdate,
				[]
			);
			updateQueryItems<RingGame>(
				queryClient,
				archivedQueryOptions.queryKey,
				applyUpdate,
				[]
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
			updateQueryItems<RingGame>(
				queryClient,
				activeQueryOptions.queryKey,
				(items) => items.filter((game) => game.id !== id),
				[]
			);
			if (archivedGame) {
				const optimisticArchivedGame = { ...archivedGame, archivedAt: now };
				updateQueryItems<RingGame>(
					queryClient,
					archivedQueryOptions.queryKey,
					(items) => [...items, optimisticArchivedGame],
					[optimisticArchivedGame]
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
			updateQueryItems<RingGame>(
				queryClient,
				archivedQueryOptions.queryKey,
				(items) => items.filter((game) => game.id !== id),
				[]
			);
			if (restoredGame) {
				const optimisticRestoredGame = { ...restoredGame, archivedAt: null };
				updateQueryItems<RingGame>(
					queryClient,
					activeQueryOptions.queryKey,
					(items) => [...items, optimisticRestoredGame],
					[optimisticRestoredGame]
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
			updateQueryItems<RingGame>(
				queryClient,
				activeQueryOptions.queryKey,
				(items) => items.filter((game) => game.id !== id),
				[]
			);
			updateQueryItems<RingGame>(
				queryClient,
				archivedQueryOptions.queryKey,
				(items) => items.filter((game) => game.id !== id),
				[]
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
		isInitialLoadError: activeQuery.isError && activeQuery.data === undefined,
		onRetry: activeQuery.refetch,
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
