import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
	applyOptimisticLiveSessionEvent,
	cancelLiveSessionCaches,
	getLiveSessionCacheRefs,
	invalidateLiveSessionCaches,
	type LiveSessionEvent,
	type LiveSessionEventType,
	restoreLiveSessionCaches,
	snapshotLiveSessionCaches,
} from "@/live-sessions/lib/live-session-cache";
import { trpc, trpcClient } from "@/utils/trpc";

function buildOptimisticEvent(
	eventType: LiveSessionEventType,
	payload: unknown
): LiveSessionEvent {
	return {
		eventType,
		id: `optimistic-${Date.now()}`,
		occurredAt: new Date().toISOString(),
		payload,
	};
}

export function useTournamentStack({ sessionId }: { sessionId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const refs = getLiveSessionCacheRefs({
		sessionId,
		sessionType: "tournament",
	});

	const sessionQuery = useQuery({
		...trpc.liveTournamentSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId,
	});
	const tournamentId = sessionQuery.data?.tournamentId ?? null;

	const chipPurchaseTypesQuery = useQuery({
		...trpc.tournamentChipPurchase.listByTournament.queryOptions({
			tournamentId: tournamentId ?? "",
		}),
		enabled: !!tournamentId,
	});
	const chipPurchaseTypes = (chipPurchaseTypesQuery.data ?? []).map((t) => ({
		name: t.name,
		cost: t.cost,
		chips: t.chips,
	}));

	const applyCreateEventMutation = useMutation({
		mutationFn: ({
			eventType,
			payload,
		}: {
			eventType: LiveSessionEventType;
			payload: unknown;
		}) =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType,
				payload,
			}),
		onMutate: async ({ eventType, payload }) => {
			await cancelLiveSessionCaches(queryClient, refs);
			const snapshot = snapshotLiveSessionCaches(queryClient, refs);

			applyOptimisticLiveSessionEvent(queryClient, refs, {
				event: buildOptimisticEvent(eventType, payload),
				eventType,
				payload,
			});

			return { snapshot };
		},
		onError: (_error, _variables, context) => {
			restoreLiveSessionCaches(queryClient, context?.snapshot);
		},
		onSettled: async () => {
			await invalidateLiveSessionCaches(queryClient, refs);
		},
	});

	const completeMutation = useMutation({
		mutationFn: (
			values:
				| {
						beforeDeadline: false;
						bountyPrizes: number;
						placement: number;
						prizeMoney: number;
						totalEntries: number;
				  }
				| {
						beforeDeadline: true;
						bountyPrizes: number;
						prizeMoney: number;
				  }
		) =>
			trpcClient.liveTournamentSession.complete.mutate({
				id: sessionId,
				...values,
			}),
		onSuccess: async () => {
			await invalidateLiveSessionCaches(queryClient, refs, {
				includeHistorical: true,
			});
			await navigate({ to: "/sessions" });
		},
	});

	return {
		chipPurchaseTypes,
		recordStack: (values: { stackAmount: number }) =>
			applyCreateEventMutation.mutate({
				eventType: "update_stack",
				payload: {
					stackAmount: values.stackAmount,
				},
			}),
		purchaseChips: (values: { name: string; cost: number; chips: number }) =>
			applyCreateEventMutation.mutate({
				eventType: "purchase_chips",
				payload: values,
			}),
		updateTournamentInfo: (values: {
			remainingPlayers: number | null;
			totalEntries: number | null;
			chipPurchaseCounts: Array<{
				name: string;
				count: number;
				chipsPerUnit: number;
			}>;
		}) =>
			applyCreateEventMutation.mutate({
				eventType: "update_tournament_info",
				payload: {
					remainingPlayers: values.remainingPlayers,
					totalEntries: values.totalEntries,
					averageStack: null,
					chipPurchaseCounts: values.chipPurchaseCounts,
				},
			}),
		complete: (
			values:
				| {
						beforeDeadline: false;
						bountyPrizes: number;
						placement: number;
						prizeMoney: number;
						totalEntries: number;
				  }
				| {
						beforeDeadline: true;
						bountyPrizes: number;
						prizeMoney: number;
				  }
		) => completeMutation.mutate(values),
		addMemo: (text: string) =>
			applyCreateEventMutation.mutate({
				eventType: "memo",
				payload: { text },
			}),
		pause: () =>
			applyCreateEventMutation.mutate({
				eventType: "session_pause",
				payload: {},
			}),
		resume: () =>
			applyCreateEventMutation.mutate({
				eventType: "session_resume",
				payload: {},
			}),
		isStackPending: applyCreateEventMutation.isPending,
		isCompletePending: completeMutation.isPending,
	};
}
