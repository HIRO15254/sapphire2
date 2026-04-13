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

function applyUpdateStackSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	if (typeof payload.stackAmount === "number") {
		summary.currentStack = payload.stackAmount;
	}
}

function applyUpdateTournamentInfoSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	const typedPayload = payload as {
		remainingPlayers?: number | null;
		totalEntries?: number | null;
	};

	if (typeof typedPayload.remainingPlayers === "number") {
		summary.remainingPlayers = typedPayload.remainingPlayers;
	}

	if (typeof typedPayload.totalEntries === "number") {
		summary.totalEntries = typedPayload.totalEntries;
	}
}

function applySessionStartSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	if (typeof payload.buyInAmount === "number") {
		summary.totalBuyIn = payload.buyInAmount;
	}
}

function applySessionEndSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	// Cash game end: cashOutAmount drives profitLoss
	if (typeof payload.cashOutAmount === "number") {
		summary.cashOut = payload.cashOutAmount;
		const totalBuyIn =
			typeof summary.totalBuyIn === "number" ? summary.totalBuyIn : 0;
		summary.profitLoss = payload.cashOutAmount - totalBuyIn;
	}

	// Tournament end (not before deadline): placement + prizes
	if (payload.beforeDeadline === false) {
		const typedPayload = payload as {
			placement?: number;
			totalEntries?: number;
			prizeMoney?: number;
			bountyPrizes?: number;
		};

		if (typeof typedPayload.placement === "number") {
			summary.placement = typedPayload.placement;
		}

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

	// Tournament end before deadline: only prizes
	if (payload.beforeDeadline === true) {
		const typedPayload = payload as {
			prizeMoney?: number;
			bountyPrizes?: number;
		};

		if (typeof typedPayload.prizeMoney === "number") {
			summary.profitLoss =
				typedPayload.prizeMoney +
				(typeof typedPayload.bountyPrizes === "number"
					? typedPayload.bountyPrizes
					: 0);
		}
	}
}

function buildOptimisticSessionSummary(
	summary: Record<string, unknown>,
	eventType: string,
	payload: Record<string, unknown>,
	occurredAt?: number
) {
	const nextSummary = { ...summary };

	switch (eventType) {
		case "session_start":
			applySessionStartSummary(nextSummary, payload);
			break;
		case "session_end":
			applySessionEndSummary(nextSummary, payload);
			break;
		case "update_stack":
			applyUpdateStackSummary(nextSummary, payload);
			break;
		case "update_tournament_info":
			applyUpdateTournamentInfoSummary(nextSummary, payload);
			break;
		// chips_add_remove affects totalBuyIn server-side; skip optimistic stack update
		// all_in, memo, session_pause, session_resume, purchase_chips, player_join,
		// player_leave: no summary fields to update optimistically
		default:
			break;
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
