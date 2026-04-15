import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createSessionEventMutationOptions } from "@/live-sessions/utils/optimistic-session-event";
import { trpc, trpcClient } from "@/utils/trpc";

export function useTournamentStack({ sessionId }: { sessionId: string }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

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

	const listKey = trpc.liveTournamentSession.list.queryOptions({}).queryKey;

	const stackMutation = useMutation({
		mutationFn: (values: { stackAmount: number }) =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType: "update_stack",
				payload: {
					stackAmount: values.stackAmount,
				},
			}),
		...createSessionEventMutationOptions<{ stackAmount: number }>({
			queryClient,
			sessionId,
			sessionType: "tournament",
			eventType: "update_stack",
			getPayload: (values) => ({ stackAmount: values.stackAmount }),
		}),
	});

	const purchaseChipsMutation = useMutation({
		mutationFn: (values: { name: string; cost: number; chips: number }) =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType: "purchase_chips",
				payload: values,
			}),
		...createSessionEventMutationOptions<{
			name: string;
			cost: number;
			chips: number;
		}>({
			queryClient,
			sessionId,
			sessionType: "tournament",
			eventType: "purchase_chips",
			getPayload: (values) => values,
		}),
	});

	const updateTournamentInfoMutation = useMutation({
		mutationFn: (values: {
			remainingPlayers: number | null;
			totalEntries: number | null;
			chipPurchaseCounts: Array<{
				name: string;
				count: number;
				chipsPerUnit: number;
			}>;
		}) =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType: "update_tournament_info",
				payload: {
					remainingPlayers: values.remainingPlayers,
					totalEntries: values.totalEntries,
					averageStack: null,
					chipPurchaseCounts: values.chipPurchaseCounts,
				},
			}),
		...createSessionEventMutationOptions<{
			remainingPlayers: number | null;
			totalEntries: number | null;
			chipPurchaseCounts: Array<{
				name: string;
				count: number;
				chipsPerUnit: number;
			}>;
		}>({
			queryClient,
			sessionId,
			sessionType: "tournament",
			eventType: "update_tournament_info",
			getPayload: (values) => ({
				remainingPlayers: values.remainingPlayers,
				totalEntries: values.totalEntries,
				averageStack: null,
				chipPurchaseCounts: values.chipPurchaseCounts,
			}),
		}),
	});

	const memoMutation = useMutation({
		mutationFn: (text: string) =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType: "memo",
				payload: { text },
			}),
		...createSessionEventMutationOptions<string>({
			queryClient,
			sessionId,
			sessionType: "tournament",
			eventType: "memo",
			getPayload: (text) => ({ text }),
		}),
	});

	const pauseMutation = useMutation({
		mutationFn: () =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType: "session_pause",
				payload: {},
			}),
		...createSessionEventMutationOptions({
			queryClient,
			sessionId,
			sessionType: "tournament",
			eventType: "session_pause",
			getPayload: () => ({}),
			changesStatus: true,
		}),
	});

	const resumeMutation = useMutation({
		mutationFn: () =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType: "session_resume",
				payload: {},
			}),
		...createSessionEventMutationOptions({
			queryClient,
			sessionId,
			sessionType: "tournament",
			eventType: "session_resume",
			getPayload: () => ({}),
			changesStatus: true,
		}),
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
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: listKey }),
				queryClient.invalidateQueries({
					queryKey: trpc.session.list.queryOptions({}).queryKey,
				}),
			]);
			await navigate({ to: "/sessions" });
		},
	});

	return {
		chipPurchaseTypes,
		recordStack: (values: { stackAmount: number }) =>
			stackMutation.mutate(values),
		purchaseChips: (values: { name: string; cost: number; chips: number }) =>
			purchaseChipsMutation.mutate(values),
		updateTournamentInfo: (values: {
			remainingPlayers: number | null;
			totalEntries: number | null;
			chipPurchaseCounts: Array<{
				name: string;
				count: number;
				chipsPerUnit: number;
			}>;
		}) => updateTournamentInfoMutation.mutate(values),
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
		addMemo: (text: string) => memoMutation.mutate(text),
		pause: () => pauseMutation.mutate(),
		resume: () => resumeMutation.mutate(),
		isStackPending: stackMutation.isPending,
		isCompletePending: completeMutation.isPending,
	};
}
