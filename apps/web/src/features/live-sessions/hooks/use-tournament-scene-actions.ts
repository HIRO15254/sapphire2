import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { TournamentFormValues } from "@/features/stores/hooks/use-tournaments";
import { useTournaments } from "@/features/stores/hooks/use-tournaments";
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

	const handleSave = async (values: TournamentFormValues) => {
		setIsSaving(true);
		try {
			// Phase 3B: tournament.update does not yet support variantId from TournamentFormValues.
			// Using type assertion until form migration completes.
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await (trpcClient.tournament.update as any).mutate({
				id: tournamentId,
				name: values.name,
				buyIn: values.buyIn ?? null,
				entryFee: values.entryFee ?? null,
				startingStack: values.startingStack ?? null,
				bountyAmount: values.bountyAmount ?? null,
				tableSize: values.tableSize ?? null,
				currencyId: values.currencyId ?? null,
				memo: values.memo ?? null,
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
					queryKey: trpc.tournamentChipPurchase.listByTournament.queryOptions({
						tournamentId,
					}).queryKey,
				},
				{
					queryKey: trpc.liveSession.getById.queryOptions({
						id: sessionId,
					}).queryKey,
				},
			]);
		} finally {
			setIsSaving(false);
		}
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
