import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface SessionEvent {
	eventType: string;
	id: string;
	occurredAt: string | Date;
	payload: unknown;
}

interface SessionSummaryData {
	summary?: Record<string, unknown>;
	[key: string]: unknown;
}

type SessionType = "cash_game" | "tournament";

function applyChipAddSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	if (typeof payload.amount !== "number") {
		return;
	}

	if (typeof summary.currentStack === "number") {
		summary.currentStack = payload.amount;
	}
}

function applyStackRecordSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	if (typeof payload.stackAmount === "number") {
		summary.currentStack = payload.stackAmount;
	}

	if (Array.isArray(payload.allIns)) {
		summary.addonCount = payload.allIns.length;
	}
}

function getChipPurchaseCountTotal(items: unknown[]) {
	return items.reduce<number>(
		(total, item) =>
			total +
			(typeof (item as { count?: unknown }).count === "number"
				? (item as { count: number }).count
				: 0),
		0
	);
}

function applyTournamentStackSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	const typedPayload = payload as {
		chipPurchaseCounts?: unknown[];
		remainingPlayers?: number | null;
		stackAmount?: number;
		totalEntries?: number | null;
	};

	if (typeof typedPayload.stackAmount === "number") {
		summary.currentStack = typedPayload.stackAmount;
	}

	if (typeof typedPayload.remainingPlayers === "number") {
		summary.remainingPlayers = typedPayload.remainingPlayers;
	}

	if (typeof typedPayload.totalEntries === "number") {
		summary.totalEntries = typedPayload.totalEntries;
	}

	if (Array.isArray(typedPayload.chipPurchaseCounts)) {
		summary.totalChipPurchases = getChipPurchaseCountTotal(
			typedPayload.chipPurchaseCounts
		);
	}
}

function applyTournamentResultSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	const typedPayload = payload as {
		bountyPrizes?: number | null;
		prizeMoney?: number;
		totalEntries?: number;
	};

	if (typeof typedPayload.totalEntries === "number") {
		summary.totalEntries = typedPayload.totalEntries;
	}

	if (typeof typedPayload.prizeMoney === "number") {
		summary.profitLoss =
			typedPayload.prizeMoney +
			(typeof typedPayload.bountyPrizes === "number"
				? typedPayload.bountyPrizes
				: 0);
	}
}

function buildOptimisticSessionSummary(
	summary: Record<string, unknown>,
	eventType: string,
	payload: Record<string, unknown>,
	occurredAt?: number
) {
	const nextSummary = { ...summary };

	if (eventType === "chip_add") {
		applyChipAddSummary(nextSummary, payload);
	}

	if (eventType === "stack_record") {
		applyStackRecordSummary(nextSummary, payload);
	}

	if (eventType === "tournament_stack_record") {
		applyTournamentStackSummary(nextSummary, payload);
	}

	if (eventType === "tournament_result") {
		applyTournamentResultSummary(nextSummary, payload);
	}

	if (occurredAt) {
		nextSummary.lastUpdatedAt = occurredAt;
	}

	return nextSummary;
}

export function useSessionEvents({
	sessionId,
	sessionType,
	refetchInterval,
}: {
	sessionId: string;
	sessionType: SessionType;
	refetchInterval?: number;
}) {
	const queryClient = useQueryClient();

	const eventQueryInput =
		sessionType === "tournament"
			? { liveTournamentSessionId: sessionId }
			: { liveCashGameSessionId: sessionId };
	const eventsQueryOptions =
		trpc.sessionEvent.list.queryOptions(eventQueryInput);
	const eventsQuery = useQuery({
		...eventsQueryOptions,
		enabled: !!sessionId,
		...(refetchInterval ? { refetchInterval } : {}),
	});
	const events = (eventsQuery.data ?? []) as SessionEvent[];

	const sessionKey =
		sessionType === "tournament"
			? trpc.liveTournamentSession.getById.queryOptions({ id: sessionId })
					.queryKey
			: trpc.liveCashGameSession.getById.queryOptions({ id: sessionId })
					.queryKey;

	const applyEventSummaryToSession = (
		event: SessionEvent,
		payload: unknown,
		occurredAt?: number
	) => {
		queryClient.setQueryData<SessionSummaryData>(sessionKey, (old) => {
			if (!(old?.summary && payload) || typeof payload !== "object") {
				return old;
			}

			return {
				...old,
				summary: buildOptimisticSessionSummary(
					old.summary,
					event.eventType,
					payload as Record<string, unknown>,
					occurredAt
				),
			};
		});
	};

	const invalidateAll = async () => {
		await invalidateTargets(queryClient, [
			{ queryKey: eventsQueryOptions.queryKey },
			{ queryKey: sessionKey },
		]);
	};

	const updateMutation = useMutation({
		mutationFn: (args: {
			id: string;
			occurredAt?: number;
			payload?: unknown;
		}) => trpcClient.sessionEvent.update.mutate(args),
		onMutate: async (args) => {
			await cancelTargets(queryClient, [
				{ queryKey: eventsQueryOptions.queryKey },
				{ queryKey: sessionKey },
			]);
			const previousEvents = snapshotQuery(
				queryClient,
				eventsQueryOptions.queryKey
			);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			const targetEvent = events.find((event) => event.id === args.id);
			queryClient.setQueryData<SessionEvent[]>(
				eventsQueryOptions.queryKey,
				(old) =>
					old?.map((event) =>
						event.id === args.id
							? {
									...event,
									occurredAt: args.occurredAt
										? new Date(args.occurredAt * 1000).toISOString()
										: event.occurredAt,
									payload: args.payload ?? event.payload,
								}
							: event
					) ?? []
			);
			if (targetEvent && args.payload) {
				applyEventSummaryToSession(targetEvent, args.payload, args.occurredAt);
			}
			return { previousEvents, previousSession };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousEvents,
				context?.previousSession,
			]);
		},
		onSuccess: async () => {
			await invalidateAll();
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.sessionEvent.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [
				{ queryKey: eventsQueryOptions.queryKey },
				{ queryKey: sessionKey },
			]);
			const previousEvents = snapshotQuery(
				queryClient,
				eventsQueryOptions.queryKey
			);
			const previousSession = snapshotQuery(queryClient, sessionKey);
			queryClient.setQueryData<SessionEvent[]>(
				eventsQueryOptions.queryKey,
				(old) => old?.filter((event) => event.id !== id) ?? []
			);
			return { previousEvents, previousSession };
		},
		onError: (_error, _variables, context) => {
			restoreSnapshots(queryClient, [
				context?.previousEvents,
				context?.previousSession,
			]);
		},
		onSuccess: async () => {
			await invalidateAll();
		},
	});

	return {
		events,
		update: (args: { id: string; payload?: unknown; occurredAt?: number }) =>
			updateMutation.mutateAsync(args),
		delete: (id: string) => deleteMutation.mutateAsync(id),
		isUpdatePending: updateMutation.isPending,
		isDeletePending: deleteMutation.isPending,
	};
}
