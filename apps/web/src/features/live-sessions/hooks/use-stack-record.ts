import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createSessionEventMutationOptions } from "@/features/live-sessions/utils/optimistic-session-event";
import { invalidateTargets } from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

interface ChipPurchaseCount {
	chipPurchaseOptionId: string;
	count: number;
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

type CompleteCashValues = { finalStack: number };

type CompleteTournamentValues =
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
	  };

export function useStackRecord({
	sessionId,
	kind,
}: {
	sessionId: string;
	kind: "cash_game" | "tournament";
}) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	// Chip purchase options for tournament
	const sessionQuery = useQuery({
		...trpc.liveSession.getById.queryOptions({ id: sessionId }),
		enabled: !!sessionId && kind === "tournament",
	});
	const chipPurchaseOptions = (
		kind === "tournament" ? (sessionQuery.data?.chipPurchaseOptions ?? []) : []
	).map((o) => ({
		id: o.id,
		name: o.name,
		cost: o.cost,
		chips: o.chips,
		sortOrder: o.sortOrder,
	}));

	const listKey = trpc.session.list.queryOptions({}).queryKey;

	const stackMutation = useMutation({
		mutationFn: (values: RecordStackValues) =>
			trpcClient.sessionEvent.create.mutate({
				sessionId,
				eventType: "update_stack",
				payload: buildStackPayload(values),
			}),
		...createSessionEventMutationOptions<RecordStackValues>({
			queryClient,
			sessionId,
			eventType: "update_stack",
			getPayload: buildStackPayload,
		}),
	});

	const purchaseChipsMutation = useMutation({
		mutationFn: (values: { chipPurchaseOptionId: string }) =>
			trpcClient.sessionEvent.create.mutate({
				sessionId,
				eventType: "purchase_chips",
				payload: values,
			}),
		...createSessionEventMutationOptions<{ chipPurchaseOptionId: string }>({
			queryClient,
			sessionId,
			eventType: "purchase_chips",
			getPayload: (values) => values,
		}),
	});

	const chipAddMutation = useMutation({
		mutationFn: (amount: number) =>
			trpcClient.sessionEvent.create.mutate({
				sessionId,
				eventType: "chips_add_remove",
				payload: { amount },
			}),
		...createSessionEventMutationOptions<number>({
			queryClient,
			sessionId,
			eventType: "chips_add_remove",
			getPayload: (amount) => ({ amount }),
		}),
	});

	const chipRemoveMutation = useMutation({
		mutationFn: (amount: number) =>
			trpcClient.sessionEvent.create.mutate({
				sessionId,
				eventType: "chips_add_remove",
				payload: { amount: -amount },
			}),
		...createSessionEventMutationOptions<number>({
			queryClient,
			sessionId,
			eventType: "chips_add_remove",
			getPayload: (amount) => ({ amount: -amount }),
		}),
	});

	const allInMutation = useMutation({
		mutationFn: (values: {
			equity: number;
			potSize: number;
			trials: number;
			wins: number;
		}) =>
			trpcClient.sessionEvent.create.mutate({
				sessionId,
				eventType: "all_in",
				payload: values,
			}),
		...createSessionEventMutationOptions<{
			equity: number;
			potSize: number;
			trials: number;
			wins: number;
		}>({
			queryClient,
			sessionId,
			eventType: "all_in",
			getPayload: (values) => values,
		}),
	});

	const memoMutation = useMutation({
		mutationFn: (text: string) =>
			trpcClient.sessionEvent.create.mutate({
				sessionId,
				eventType: "memo",
				payload: { text },
			}),
		...createSessionEventMutationOptions<string>({
			queryClient,
			sessionId,
			eventType: "memo",
			getPayload: (text) => ({ text }),
		}),
	});

	const pauseMutation = useMutation({
		mutationFn: () =>
			trpcClient.sessionEvent.create.mutate({
				sessionId,
				eventType: "session_pause",
				payload: {},
			}),
		...createSessionEventMutationOptions({
			queryClient,
			sessionId,
			eventType: "session_pause",
			getPayload: () => ({}),
			changesStatus: true,
		}),
	});

	const resumeMutation = useMutation({
		mutationFn: () =>
			trpcClient.sessionEvent.create.mutate({
				sessionId,
				eventType: "session_resume",
				payload: {},
			}),
		...createSessionEventMutationOptions({
			queryClient,
			sessionId,
			eventType: "session_resume",
			getPayload: () => ({}),
			changesStatus: true,
		}),
	});

	const completeCashMutation = useMutation({
		mutationFn: (values: CompleteCashValues) =>
			trpcClient.liveSession.complete.mutate({
				id: sessionId,
				kind: "cash_game",
				finalStack: values.finalStack,
			}),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: listKey }]);
			await navigate({ to: "/sessions" });
		},
	});

	const completeTournamentMutation = useMutation({
		mutationFn: (values: CompleteTournamentValues) =>
			trpcClient.liveSession.complete.mutate({
				id: sessionId,
				kind: "tournament",
				...values,
			}),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: listKey }]);
			await navigate({ to: "/sessions" });
		},
	});

	return {
		chipPurchaseOptions,
		recordStack: (values: RecordStackValues) => stackMutation.mutate(values),
		purchaseChips: (values: { chipPurchaseOptionId: string }) =>
			purchaseChipsMutation.mutate(values),
		addChip: (amount: number) => chipAddMutation.mutate(amount),
		removeChip: (amount: number) => chipRemoveMutation.mutate(amount),
		addAllIn: (values: {
			equity: number;
			potSize: number;
			trials: number;
			wins: number;
		}) => allInMutation.mutate(values),
		addMemo: (text: string) => memoMutation.mutate(text),
		pause: () => pauseMutation.mutate(),
		resume: () => resumeMutation.mutate(),
		completeCash: (values: CompleteCashValues) =>
			completeCashMutation.mutate(values),
		completeTournament: (values: CompleteTournamentValues) =>
			completeTournamentMutation.mutate(values),
		isStackPending: stackMutation.isPending,
		isCompletePending:
			completeCashMutation.isPending || completeTournamentMutation.isPending,
	};
}
