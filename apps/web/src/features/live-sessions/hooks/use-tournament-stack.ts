import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createSessionEventMutationOptions } from "@/features/live-sessions/utils/optimistic-session-event";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

interface ChipPurchaseCount {
	chipsPerUnit: number;
	count: number;
	name: string;
}

interface RecordStackValues {
	chipPurchaseCounts?: ChipPurchaseCount[];
	remainingPlayers?: number | null;
	stackAmount: number;
	totalEntries?: number | null;
}

function buildStackPayload(values: RecordStackValues) {
	const payload: Record<string, unknown> = { stackAmount: values.stackAmount };
	if (values.remainingPlayers !== undefined) {
		payload.remainingPlayers = values.remainingPlayers;
	}
	if (values.totalEntries !== undefined) {
		payload.totalEntries = values.totalEntries;
	}
	if (values.chipPurchaseCounts !== undefined) {
		payload.chipPurchaseCounts = values.chipPurchaseCounts;
	}
	return payload;
}

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
		mutationFn: (values: RecordStackValues) =>
			trpcClient.sessionEvent.create.mutate({
				liveTournamentSessionId: sessionId,
				eventType: "update_stack",
				payload: buildStackPayload(values),
			}),
		...createSessionEventMutationOptions<RecordStackValues>({
			queryClient,
			sessionId,
			sessionType: "tournament",
			eventType: "update_stack",
			getPayload: buildStackPayload,
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
			await invalidateTargets(queryClient, [
				{ queryKey: listKey },
				{ queryKey: trpc.session.list.queryOptions({}).queryKey },
			]);
			await navigate({ to: "/sessions" });
		},
	});

	return {
		chipPurchaseTypes,
		recordStack: (values: RecordStackValues) => stackMutation.mutate(values),
		purchaseChips: (values: { name: string; cost: number; chips: number }) =>
			purchaseChipsMutation.mutate(values),
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
