import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { TournamentPartialFormValues } from "@/stores/components/tournament-modal-content";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import type {
	Tournament,
	TournamentFormValues,
} from "@/stores/hooks/use-tournaments";
import { useTournaments } from "@/stores/hooks/use-tournaments";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

function tournamentToInitialFormValues(
	tournament: Tournament
): TournamentPartialFormValues {
	return {
		name: tournament.name,
		variant: tournament.variant,
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

function levelsToPayload(levels: BlindLevelRow[]) {
	return levels.map((l) => ({
		isBreak: l.isBreak,
		blind1: l.blind1,
		blind2: l.blind2,
		blind3: l.blind3,
		ante: l.ante,
		minutes: l.minutes,
	}));
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
		...trpc.blindLevel.listByTournament.queryOptions({
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
			await trpcClient.tournament.createWithLevels.mutate({
				storeId,
				name: values.name,
				variant: values.variant,
				buyIn: values.buyIn,
				entryFee: values.entryFee,
				startingStack: values.startingStack,
				bountyAmount: values.bountyAmount,
				tableSize: values.tableSize,
				currencyId: values.currencyId,
				memo: values.memo,
				tags: values.tags,
				chipPurchases: values.chipPurchases,
				blindLevels: levelsToPayload(levels),
			});
			await invalidateTournamentLists();
			setIsCreateOpen(false);
		} finally {
			setIsCreateLoading(false);
		}
	};

	const handleUpdate = async (
		values: TournamentFormValues,
		levels: BlindLevelRow[]
	) => {
		if (!editingTournament) {
			return;
		}
		setIsUpdateLoading(true);
		try {
			await trpcClient.tournament.updateWithLevels.mutate({
				id: editingTournament.id,
				name: values.name,
				variant: values.variant,
				buyIn: values.buyIn ?? null,
				entryFee: values.entryFee ?? null,
				startingStack: values.startingStack ?? null,
				bountyAmount: values.bountyAmount ?? null,
				tableSize: values.tableSize ?? null,
				currencyId: values.currencyId ?? null,
				memo: values.memo ?? null,
				tags: values.tags,
				chipPurchases: values.chipPurchases,
				blindLevels: levelsToPayload(levels),
			});
			await Promise.all([
				invalidateTournamentLists(),
				invalidateTargets(queryClient, [
					{
						queryKey: trpc.blindLevel.listByTournament.queryOptions({
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
	const editInitialLevels = (editBlindLevelsQuery.data ??
		[]) as BlindLevelRow[];

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
		trpc.blindLevel.listByTournament.queryOptions({ tournamentId })
	);
	return {
		levels: (levelsQuery.data ?? []) as BlindLevelRow[],
		isLoading: levelsQuery.isLoading,
	};
}
