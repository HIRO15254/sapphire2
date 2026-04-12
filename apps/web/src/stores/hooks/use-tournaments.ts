import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface ChipPurchase {
	chips: number;
	cost: number;
	id: string;
	name: string;
	sortOrder: number;
}

export interface Tournament {
	archivedAt: string | null;
	blindLevelCount: number;
	bountyAmount: number | null;
	buyIn: number | null;
	chipPurchases: ChipPurchase[];
	createdAt: string;
	currencyId: string | null;
	entryFee: number | null;
	id: string;
	memo: string | null;
	name: string;
	startingStack: number | null;
	storeId: string;
	tableSize: number | null;
	tags: { id: string; name: string }[];
	updatedAt: string;
	variant: string;
}

export interface ChipPurchaseFormItem {
	chips: number;
	cost: number;
	name: string;
}

export interface TournamentFormValues {
	bountyAmount?: number;
	buyIn?: number;
	chipPurchases: ChipPurchaseFormItem[];
	currencyId?: string;
	entryFee?: number;
	memo?: string;
	name: string;
	startingStack?: number;
	tableSize?: number;
	tags?: string[];
	variant: string;
}

function buildOptimisticTournament(
	storeId: string,
	values: TournamentFormValues,
	id: string,
	existing?: Tournament
): Tournament {
	return {
		archivedAt: existing?.archivedAt ?? null,
		blindLevelCount: existing?.blindLevelCount ?? 0,
		bountyAmount: values.bountyAmount ?? null,
		buyIn: values.buyIn ?? null,
		chipPurchases:
			values.chipPurchases?.map((chipPurchase, index) => ({
				chips: chipPurchase.chips,
				cost: chipPurchase.cost,
				id: `${id}-chip-${String(index)}`,
				name: chipPurchase.name,
				sortOrder: index,
			})) ?? [],
		currencyId: values.currencyId ?? null,
		entryFee: values.entryFee ?? null,
		id,
		memo: values.memo ?? null,
		name: values.name,
		startingStack: values.startingStack ?? null,
		storeId,
		tableSize: values.tableSize ?? null,
		createdAt: existing?.createdAt ?? new Date().toISOString(),
		tags:
			values.tags?.map((tagName, index) => {
				const existingTag = existing?.tags.find((tag) => tag.name === tagName);
				return {
					id: existingTag?.id ?? `${id}-tag-${String(index)}`,
					name: tagName,
				};
			}) ??
			existing?.tags ??
			[],
		updatedAt: new Date().toISOString(),
		variant: values.variant,
	};
}

interface UseTournamentsOptions {
	showArchived: boolean;
	storeId: string;
}

export function useTournaments({
	storeId,
	showArchived,
}: UseTournamentsOptions) {
	const queryClient = useQueryClient();

	const activeQueryOptions = trpc.tournament.listByStore.queryOptions({
		storeId,
		includeArchived: false,
	});
	const archivedQueryOptions = trpc.tournament.listByStore.queryOptions({
		storeId,
		includeArchived: true,
	});

	const activeQuery = useQuery(activeQueryOptions);
	const activeTournaments = (activeQuery.data ?? []) as Tournament[];

	const archivedQuery = useQuery({
		...archivedQueryOptions,
		enabled: showArchived,
	});
	const archivedTournaments = (archivedQuery.data ?? []) as Tournament[];

	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const syncTags = async (
		tournamentId: string,
		newTags: string[],
		existingTags: { id: string; name: string }[]
	) => {
		const existingNames = existingTags.map((t) => t.name);
		const toAdd = newTags.filter((t) => !existingNames.includes(t));
		const toRemove = existingTags.filter((t) => !newTags.includes(t.name));
		await Promise.all([
			...toAdd.map((name) =>
				trpcClient.tournament.addTag.mutate({ tournamentId, name })
			),
			...toRemove.map((tag) =>
				trpcClient.tournament.removeTag.mutate({ id: tag.id })
			),
		]);
	};

	const invalidateBoth = () => {
		invalidateTargets(queryClient, [
			{ queryKey: activeQueryOptions.queryKey },
			{ queryKey: archivedQueryOptions.queryKey },
		]);
	};

	const syncChipPurchases = async (
		tournamentId: string,
		chipPurchases: ChipPurchaseFormItem[],
		existingIds: string[]
	) => {
		await Promise.all(
			existingIds.map((id) =>
				trpcClient.tournamentChipPurchase.delete.mutate({ id })
			)
		);
		await Promise.all(
			chipPurchases.map((cp) =>
				trpcClient.tournamentChipPurchase.create.mutate({
					tournamentId,
					name: cp.name,
					cost: cp.cost,
					chips: cp.chips,
				})
			)
		);
	};

	const createMutation = useMutation({
		mutationFn: async (values: TournamentFormValues) => {
			const { tags, chipPurchases, ...rest } = values;
			const created = await trpcClient.tournament.create.mutate({
				storeId,
				...rest,
			});
			if (tags && tags.length > 0) {
				await syncTags(created.id, tags, []);
			}
			if (chipPurchases.length > 0) {
				await syncChipPurchases(created.id, chipPurchases, []);
			}
			return created;
		},
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
			queryClient.setQueryData<Tournament[]>(
				activeQueryOptions.queryKey,
				(old) => [
					...(old ?? []),
					buildOptimisticTournament(
						storeId,
						values,
						`temp-tournament-${Date.now()}`
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
		onSettled: invalidateBoth,
	});

	const updateMutation = useMutation({
		mutationFn: async (
			values: TournamentFormValues & {
				existingChipPurchaseIds: string[];
				existingTags: { id: string; name: string }[];
				id: string;
			}
		) => {
			const {
				tags,
				existingTags,
				chipPurchases,
				existingChipPurchaseIds,
				...rest
			} = values;
			const updated = await trpcClient.tournament.update.mutate(rest);
			if (tags !== undefined) {
				await syncTags(values.id, tags, existingTags);
			}
			await syncChipPurchases(
				values.id,
				chipPurchases,
				existingChipPurchaseIds
			);
			return updated;
		},
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
			const applyUpdate = (old: Tournament[] | undefined) =>
				old?.map((tournament) =>
					tournament.id === values.id
						? buildOptimisticTournament(storeId, values, values.id, tournament)
						: tournament
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
		mutationFn: (id: string) => trpcClient.tournament.archive.mutate({ id }),
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
			const archivedTournament = (
				previousActive.data as Tournament[] | undefined
			)?.find((tournament) => tournament.id === id);
			queryClient.setQueryData<Tournament[]>(
				activeQueryOptions.queryKey,
				(old) => old?.filter((tournament) => tournament.id !== id) ?? []
			);
			if (archivedTournament) {
				queryClient.setQueryData<Tournament[]>(
					archivedQueryOptions.queryKey,
					(old) => [
						...(old ?? []),
						{ ...archivedTournament, archivedAt: new Date().toISOString() },
					]
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
		mutationFn: (id: string) => trpcClient.tournament.restore.mutate({ id }),
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
			const restoredTournament = (
				previousArchived.data as Tournament[] | undefined
			)?.find((tournament) => tournament.id === id);
			queryClient.setQueryData<Tournament[]>(
				archivedQueryOptions.queryKey,
				(old) => old?.filter((tournament) => tournament.id !== id) ?? []
			);
			if (restoredTournament) {
				queryClient.setQueryData<Tournament[]>(
					activeQueryOptions.queryKey,
					(old) => [...(old ?? []), { ...restoredTournament, archivedAt: null }]
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
		mutationFn: (id: string) => trpcClient.tournament.delete.mutate({ id }),
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
			queryClient.setQueryData<Tournament[]>(
				activeQueryOptions.queryKey,
				(old) => old?.filter((tournament) => tournament.id !== id) ?? []
			);
			queryClient.setQueryData<Tournament[]>(
				archivedQueryOptions.queryKey,
				(old) => old?.filter((tournament) => tournament.id !== id) ?? []
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
		activeTournaments,
		archivedTournaments,
		currencies,
		activeLoading: activeQuery.isLoading,
		archivedLoading: archivedQuery.isLoading,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		create: (values: TournamentFormValues) =>
			createMutation.mutateAsync(values),
		update: (
			values: TournamentFormValues & {
				existingChipPurchaseIds: string[];
				existingTags: { id: string; name: string }[];
				id: string;
			}
		) => updateMutation.mutateAsync(values),
		archive: (id: string) => archiveMutation.mutate(id),
		restore: (id: string) => restoreMutation.mutate(id),
		delete: (id: string) => deleteMutation.mutate(id),
	};
}
