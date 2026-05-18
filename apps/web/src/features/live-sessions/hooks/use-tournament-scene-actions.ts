import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { BlindLevelRow } from "@/features/stores/hooks/use-blind-levels";
import type { TournamentFormValues } from "@/features/stores/hooks/use-tournaments";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

interface UseTournamentSceneActionsArgs {
	sessionId: string;
}

/**
 * Edit a live tournament session's frozen rule snapshot. Writes go to
 * `session_tournament_detail`, `session_blind_level`, and
 * `session_chip_purchase` — the master `tournament` row is never touched.
 * Use this for the live-session edit dialog so per-session overrides do
 * not leak back into the master template.
 */
export function useTournamentSceneActions({
	sessionId,
}: UseTournamentSceneActionsArgs) {
	const queryClient = useQueryClient();
	const [isEditOpen, setIsEditOpen] = useState(false);

	const sessionKey = trpc.liveTournamentSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;

	const updateMutation = useMutation({
		mutationFn: ({
			values,
			updatedLevels,
		}: {
			values: TournamentFormValues;
			updatedLevels: BlindLevelRow[];
		}) =>
			trpcClient.liveTournamentSession.updateSnapshot.mutate({
				id: sessionId,
				ruleName: values.name,
				variant: values.variant,
				tournamentBuyIn: values.buyIn ?? null,
				entryFee: values.entryFee ?? null,
				startingStack: values.startingStack ?? null,
				bountyAmount: values.bountyAmount ?? null,
				tableSize: values.tableSize ?? null,
				chipPurchases: values.chipPurchases,
				blindLevels: updatedLevels.map((l) => ({
					isBreak: l.isBreak,
					blind1: l.blind1,
					blind2: l.blind2,
					blind3: l.blind3,
					ante: l.ante,
					minutes: l.minutes,
				})),
			}),
		onSettled: () => invalidateTargets(queryClient, [{ queryKey: sessionKey }]),
	});

	const handleSave = async (
		values: TournamentFormValues,
		updatedLevels: BlindLevelRow[]
	) => {
		await updateMutation.mutateAsync({ values, updatedLevels });
		setIsEditOpen(false);
	};

	return {
		isEditOpen,
		setIsEditOpen,
		handleSave,
		isSaving: updateMutation.isPending,
		isUpdateWithLevelsPending: updateMutation.isPending,
	};
}
