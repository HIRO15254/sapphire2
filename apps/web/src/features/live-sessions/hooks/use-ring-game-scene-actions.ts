import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { RingGameFormValues } from "@/features/rooms/hooks/use-ring-games";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

interface UseRingGameSceneActionsArgs {
	sessionId: string;
}

/**
 * Edit a live cash session's frozen ring-game snapshot. Writes go to
 * `session_cash_detail` only — the master `ring_game` row is never
 * touched. Use this for the live-session edit dialog.
 */
export function useRingGameSceneActions({
	sessionId,
}: UseRingGameSceneActionsArgs) {
	const queryClient = useQueryClient();
	const [isEditOpen, setIsEditOpen] = useState(false);
	const currenciesQuery = useQuery(trpc.currency.list.queryOptions());
	const currencies = currenciesQuery.data ?? [];

	const sessionKey = trpc.liveCashGameSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;

	const updateMutation = useMutation({
		mutationFn: (values: RingGameFormValues) =>
			trpcClient.liveCashGameSession.updateSnapshot.mutate({
				id: sessionId,
				ruleName: values.name,
				variant: values.variant,
				blind1: values.blind1 ?? null,
				blind2: values.blind2 ?? null,
				blind3: values.blind3 ?? null,
				ante: values.ante ?? null,
				anteType: values.anteType ?? null,
				minBuyIn: values.minBuyIn ?? null,
				maxBuyIn: values.maxBuyIn ?? null,
				tableSize: values.tableSize ?? null,
			}),
		onSettled: () => invalidateTargets(queryClient, [{ queryKey: sessionKey }]),
	});

	const handleUpdate = async (values: RingGameFormValues) => {
		await updateMutation.mutateAsync(values);
		setIsEditOpen(false);
	};

	return {
		isEditOpen,
		setIsEditOpen,
		handleUpdate,
		isUpdatePending: updateMutation.isPending,
		currencies,
	};
}
