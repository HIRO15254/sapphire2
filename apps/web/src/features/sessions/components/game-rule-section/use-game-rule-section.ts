import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface CashDetail {
	maxBuyIn?: number | null;
	minBuyIn?: number | null;
	ringGameId?: string | null;
	ruleName?: string | null;
	tableSize?: number | null;
	variantId?: number | null;
}

export interface TournamentDetail {
	bountyAmount?: number | null;
	buyIn?: number | null;
	entryFee?: number | null;
	ruleName?: string | null;
	startingStack?: number | null;
	tableSize?: number | null;
	timerStartedAt?: Date | null;
	tournamentId?: string | null;
	variantId?: number | null;
}

interface UseGameRuleSectionArgs {
	cashDetail?: CashDetail | null;
	/** live sessions: can call liveSession.updateRule. manual sessions: undefined (no live mutations) */
	isLive: boolean;
	isReadOnly: boolean;
	kind: "cash_game" | "tournament";
	sessionId: string;
	tournamentDetail?: TournamentDetail | null;
}

export function useGameRuleSection({
	sessionId,
	kind,
	cashDetail,
	tournamentDetail,
	isLive,
	isReadOnly,
}: UseGameRuleSectionArgs) {
	const queryClient = useQueryClient();
	const sessionQueryKey = trpc.liveSession.getById.queryOptions({
		id: sessionId,
	}).queryKey;

	const updateRuleMutation = useMutation({
		mutationFn: (
			fields:
				| {
						kind: "cash_game";
						ruleName?: string;
						minBuyIn?: number | null;
						maxBuyIn?: number | null;
						tableSize?: number | null;
						variantId?: number;
						ringGameId?: string | null;
				  }
				| {
						kind: "tournament";
						ruleName?: string;
						startingStack?: number | null;
						bountyAmount?: number | null;
						tableSize?: number | null;
						variantId?: number;
						buyIn?: number;
						entryFee?: number;
						tournamentId?: string | null;
						timerStartedAt?: Date | null;
				  }
		) =>
			trpcClient.liveSession.updateRule.mutate({
				id: sessionId,
				...fields,
			}),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionQueryKey }]);
		},
	});

	return {
		kind,
		cashDetail,
		tournamentDetail,
		isLive,
		isReadOnly,
		isUpdatePending: updateRuleMutation.isPending,
		updateRule: (fields: Parameters<typeof updateRuleMutation.mutate>[0]) =>
			updateRuleMutation.mutate(fields),
	};
}
