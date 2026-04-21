import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { RingGameFormValues } from "@/stores/hooks/use-ring-games";
import { useRingGames } from "@/stores/hooks/use-ring-games";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

interface UseRingGameSceneActionsArgs {
	ringGameId: string;
	sessionId: string;
	storeId: string;
}

export function useRingGameSceneActions({
	ringGameId,
	sessionId,
	storeId,
}: UseRingGameSceneActionsArgs) {
	const queryClient = useQueryClient();
	const [isEditOpen, setIsEditOpen] = useState(false);
	const { update, isUpdatePending, currencies } = useRingGames({
		storeId,
		showArchived: false,
	});

	const handleUpdate = async (values: RingGameFormValues) => {
		await update({ id: ringGameId, ...values });
		await invalidateTargets(queryClient, [
			{
				queryKey: trpc.liveCashGameSession.getById.queryOptions({
					id: sessionId,
				}).queryKey,
			},
		]);
		setIsEditOpen(false);
	};

	return {
		isEditOpen,
		setIsEditOpen,
		handleUpdate,
		isUpdatePending,
		currencies,
	};
}
