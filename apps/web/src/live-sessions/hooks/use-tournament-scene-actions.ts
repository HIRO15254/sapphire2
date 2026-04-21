import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BlindLevelRow } from "@/stores/hooks/use-blind-levels";
import type { TournamentFormValues } from "@/stores/hooks/use-tournaments";
import { useTournaments } from "@/stores/hooks/use-tournaments";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

interface UseTournamentSceneActionsArgs {
	sessionId: string;
	storeId: string;
	tournamentId: string;
}

export function useTournamentSceneActions({
	sessionId,
	storeId,
	tournamentId,
}: UseTournamentSceneActionsArgs) {
	const queryClient = useQueryClient();
	const [isEditOpen, setIsEditOpen] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const { isUpdateWithLevelsPending } = useTournaments({
		storeId,
		showArchived: false,
	});

	const save = async (
		values: TournamentFormValues,
		updatedLevels: BlindLevelRow[]
	) => {
		setIsSaving(true);
		try {
			await trpcClient.tournament.updateWithLevels.mutate({
				id: tournamentId,
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
				blindLevels: updatedLevels.map((l) => ({
					isBreak: l.isBreak,
					blind1: l.blind1,
					blind2: l.blind2,
					blind3: l.blind3,
					ante: l.ante,
					minutes: l.minutes,
				})),
			});
			await invalidateTargets(queryClient, [
				{
					queryKey: trpc.tournament.getById.queryOptions({ id: tournamentId })
						.queryKey,
				},
				{
					queryKey: trpc.tournament.listByStore.queryOptions({
						storeId,
						includeArchived: false,
					}).queryKey,
				},
				{
					queryKey: trpc.blindLevel.listByTournament.queryOptions({
						tournamentId,
					}).queryKey,
				},
				{
					queryKey: trpc.tournamentChipPurchase.listByTournament.queryOptions({
						tournamentId,
					}).queryKey,
				},
				{
					queryKey: trpc.liveTournamentSession.getById.queryOptions({
						id: sessionId,
					}).queryKey,
				},
			]);
		} finally {
			setIsSaving(false);
		}
	};

	const handleSave = async (
		values: TournamentFormValues,
		updatedLevels: BlindLevelRow[]
	) => {
		await save(values, updatedLevels);
		setIsEditOpen(false);
	};

	return {
		isEditOpen,
		setIsEditOpen,
		handleSave,
		isSaving,
		isUpdateWithLevelsPending,
	};
}
