import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { TournamentPartialFormValues } from "@/features/stores/components/tournament-modal-content";
import type { BlindLevelRow } from "@/features/stores/hooks/use-blind-levels";
import type {
	Tournament,
	TournamentFormValues,
} from "@/features/stores/hooks/use-tournaments";
import { useTournaments } from "@/features/stores/hooks/use-tournaments";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

function tournamentToInitialFormValues(
	tournament: Tournament
): TournamentPartialFormValues {
	return {
		name: tournament.name,
		variantId: tournament.variantId ?? undefined,
		buyIn: tournament.buyIn ?? undefined,
		entryFee: tournament.entryFee ?? undefined,
		startingStack: tournament.startingStack ?? undefined,
		chipPurchases: tournament.chipPurchases.map((cp) => ({
			name: cp.name,
			cost: cp.cost,
			chips: cp.chips,
		})),
		bountyAmount: tournament.bountyAmount ?? undefined,
		tableSize: tournament.tableSize ?? undefined,
		currencyId: tournament.currencyId ?? undefined,
		memo: tournament.memo ?? undefined,
		tags: tournament.tags.map((t) => t.name),
	};
}

interface UseTournamentTabOptions {
	storeId: string;
}

export function useTournamentTab({ storeId }: UseTournamentTabOptions) {
	const queryClient = useQueryClient();
	const [showArchived, setShowArchived] = useState(false);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [editingTournament, setEditingTournament] = useState<Tournament | null>(
		null
	);
	const [isCreateLoading, setIsCreateLoading] = useState(false);
	const [isUpdateLoading, setIsUpdateLoading] = useState(false);

	const {
		activeTournaments,
		archivedTournaments,
		currencies,
		activeLoading,
		archivedLoading,
		archive,
		restore,
		delete: deleteTournament,
	} = useTournaments({ storeId, showArchived });

	const editBlindLevelsQuery = useQuery({
		...trpc.tournament.listBlindLevels.queryOptions({
			tournamentId: editingTournament?.id ?? "",
		}),
		enabled: editingTournament !== null,
	});

	const invalidateTournamentLists = () =>
		invalidateTargets(queryClient, [
			{
				queryKey: trpc.tournament.listByStore.queryOptions({
					storeId,
					includeArchived: false,
				}).queryKey,
			},
			{
				queryKey: trpc.tournament.listByStore.queryOptions({
					storeId,
					includeArchived: true,
				}).queryKey,
			},
		]);

	const handleCreate = async (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => {
		setIsCreateLoading(true);
		try {
			const { tags, chipPurchases, ...rest } = values;
			const created = await trpcClient.tournament.create.mutate({
				storeId,
				...rest,
			});
			if (tags && tags.length > 0) {
				await Promise.all(
					tags.map((name) =>
						trpcClient.tournament.addTag.mutate({
							tournamentId: created.id,
							name,
						})
					)
				);
			}
			for (let i = 0; i < levels.length; i++) {
				const level = levels[i];
				await trpcClient.tournament.addBlindLevel.mutate({
					tournamentId: created.id,
					levelIndex: i,
					isBreak: level.isBreak,
					minutes: level.minutes ?? undefined,
					sortOrder: i,
				});
			}
			if (chipPurchases.length > 0) {
				await Promise.all(
					chipPurchases.map((cp) =>
						trpcClient.tournamentChipPurchase.create.mutate({
							tournamentId: created.id,
							name: cp.name,
							cost: cp.cost,
							chips: cp.chips,
						})
					)
				);
			}
			await invalidateTournamentLists();
			setIsCreateOpen(false);
		} finally {
			setIsCreateLoading(false);
		}
	};

	const handleUpdate = async (
		values: TournamentFormValues,
		_levels: BlindLevelRow[]
	) => {
		if (!editingTournament) {
			return;
		}
		setIsUpdateLoading(true);
		try {
			const { tags, chipPurchases, ...rest } = values;
			await trpcClient.tournament.update.mutate({
				id: editingTournament.id,
				name: rest.name,
				variantId: rest.variantId ?? null,
				buyIn: rest.buyIn ?? null,
				entryFee: rest.entryFee ?? null,
				startingStack: rest.startingStack ?? null,
				bountyAmount: rest.bountyAmount ?? null,
				tableSize: rest.tableSize ?? null,
				currencyId: rest.currencyId ?? null,
				memo: rest.memo ?? null,
			});
			if (tags !== undefined) {
				await Promise.all(
					tags.map((name) =>
						trpcClient.tournament.addTag.mutate({
							tournamentId: editingTournament.id,
							name,
						})
					)
				);
			}
			await Promise.all([
				invalidateTournamentLists(),
				invalidateTargets(queryClient, [
					{
						queryKey: trpc.tournament.listBlindLevels.queryOptions({
							tournamentId: editingTournament.id,
						}).queryKey,
					},
				]),
			]);
			setEditingTournament(null);
		} finally {
			setIsUpdateLoading(false);
		}
	};

	const editInitialFormValues = editingTournament
		? tournamentToInitialFormValues(editingTournament)
		: undefined;
	const editInitialLevels: BlindLevelRow[] = (
		editBlindLevelsQuery.data ?? []
	).map((apiLevel) => {
		const primarySet = apiLevel.blindSets[0];
		return {
			id: String(apiLevel.id),
			tournamentId: apiLevel.tournamentId,
			level: apiLevel.levelIndex + 1,
			isBreak: apiLevel.isBreak,
			blind1: primarySet?.blind1 ?? null,
			blind2: primarySet?.blind2 ?? null,
			blind3: primarySet?.blind3 ?? null,
			ante: primarySet?.ante ?? null,
			minutes: apiLevel.minutes ?? null,
		};
	});

	return {
		activeTournaments,
		archivedTournaments,
		currencies,
		activeLoading,
		archivedLoading,
		archive,
		restore,
		deleteTournament,
		showArchived,
		setShowArchived,
		isCreateOpen,
		setIsCreateOpen,
		editingTournament,
		setEditingTournament,
		isCreateLoading,
		isUpdateLoading,
		editBlindLevelsLoading: editBlindLevelsQuery.isLoading,
		editInitialFormValues,
		editInitialLevels,
		handleCreate,
		handleUpdate,
	};
}

export function useBlindStructureSummary(tournamentId: string) {
	const levelsQuery = useQuery(
		trpc.tournament.listBlindLevels.queryOptions({ tournamentId })
	);
	const levels: BlindLevelRow[] = (levelsQuery.data ?? []).map((apiLevel) => {
		const primarySet = apiLevel.blindSets[0];
		return {
			id: String(apiLevel.id),
			tournamentId: apiLevel.tournamentId,
			level: apiLevel.levelIndex + 1,
			isBreak: apiLevel.isBreak,
			blind1: primarySet?.blind1 ?? null,
			blind2: primarySet?.blind2 ?? null,
			blind3: primarySet?.blind3 ?? null,
			ante: primarySet?.ante ?? null,
			minutes: apiLevel.minutes ?? null,
		};
	});
	return {
		levels,
		isLoading: levelsQuery.isLoading,
	};
}
