import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { SessionEvent } from "@/live-sessions/hooks/use-session-events";
import {
	cancelTargets,
	invalidateTargets,
	type OptimisticSnapshot,
	restoreSnapshots,
	snapshotQueries,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

// ---------------------------------------------------------------------------
// Summary helpers (extracted from use-session-events.ts)
// ---------------------------------------------------------------------------

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

export function buildOptimisticSessionSummary(
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

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------

type SessionStatus = "active" | "completed" | "paused";

export function deriveOptimisticStatus(
	currentStatus: SessionStatus,
	eventType: string
): SessionStatus {
	if (eventType === "session_pause") {
		return "paused";
	}
	if (eventType === "session_resume") {
		return "active";
	}
	if (eventType === "session_end") {
		return "completed";
	}
	return currentStatus;
}

// ---------------------------------------------------------------------------
// Optimistic event builder
// ---------------------------------------------------------------------------

export function buildOptimisticEvent(
	eventType: string,
	payload: unknown
): SessionEvent {
	return {
		id: `optimistic-${Date.now()}`,
		eventType,
		payload,
		occurredAt: new Date().toISOString(),
	};
}

// ---------------------------------------------------------------------------
// Query key helpers
// ---------------------------------------------------------------------------

type SessionType = "cash_game" | "tournament";

export function getSessionQueryKeys(
	sessionId: string,
	sessionType: SessionType
) {
	if (sessionType === "cash_game") {
		return {
			sessionKey: trpc.liveCashGameSession.getById.queryOptions({
				id: sessionId,
			}).queryKey,
			eventsKey: trpc.sessionEvent.list.queryOptions({
				liveCashGameSessionId: sessionId,
			}).queryKey,
			activeListKey: trpc.liveCashGameSession.list.queryOptions({
				status: "active",
				limit: 1,
			}).queryKey,
			pausedListKey: trpc.liveCashGameSession.list.queryOptions({
				status: "paused",
				limit: 1,
			}).queryKey,
			allListsKey: trpc.liveCashGameSession.list.queryOptions({}).queryKey,
		};
	}

	return {
		sessionKey: trpc.liveTournamentSession.getById.queryOptions({
			id: sessionId,
		}).queryKey,
		eventsKey: trpc.sessionEvent.list.queryOptions({
			liveTournamentSessionId: sessionId,
		}).queryKey,
		activeListKey: trpc.liveTournamentSession.list.queryOptions({
			status: "active",
			limit: 1,
		}).queryKey,
		pausedListKey: trpc.liveTournamentSession.list.queryOptions({
			status: "paused",
			limit: 1,
		}).queryKey,
		allListsKey: trpc.liveTournamentSession.list.queryOptions({}).queryKey,
	};
}

// ---------------------------------------------------------------------------
// createSessionEventMutationOptions
// ---------------------------------------------------------------------------

interface SessionSummaryData {
	status?: SessionStatus;
	summary?: Record<string, unknown>;
	[key: string]: unknown;
}

interface ListData {
	items?: Array<{ id: string; status?: string; [key: string]: unknown }>;
	nextCursor?: string;
}

interface SnapshotContext {
	previousEvents: OptimisticSnapshot;
	previousLists: OptimisticSnapshot;
	previousSession: OptimisticSnapshot;
}

interface SessionEventMutationConfig<TVariables = void> {
	changesStatus?: boolean;
	eventType: string;
	getPayload: (variables: TVariables) => Record<string, unknown>;
	queryClient: QueryClient;
	sessionId: string;
	sessionType: SessionType;
}

export function createSessionEventMutationOptions<TVariables = void>({
	queryClient,
	sessionId,
	sessionType,
	eventType,
	getPayload,
	changesStatus,
}: SessionEventMutationConfig<TVariables>) {
	const { sessionKey, eventsKey, activeListKey, pausedListKey, allListsKey } =
		getSessionQueryKeys(sessionId, sessionType);

	return {
		onMutate: async (variables: TVariables): Promise<SnapshotContext> => {
			const payload = getPayload(variables);

			// 1. Cancel in-flight queries
			await cancelTargets(queryClient, [
				{ queryKey: sessionKey },
				{ queryKey: eventsKey },
				{ queryKey: activeListKey },
				{ queryKey: pausedListKey },
			]);

			// 2. Snapshot
			const previousSession = snapshotQuery(queryClient, sessionKey);
			const previousEvents = snapshotQuery(queryClient, eventsKey);
			const previousLists = snapshotQueries(queryClient, {
				queryKey: allListsKey,
			});

			// 3. Optimistic: append event to events list
			queryClient.setQueryData<SessionEvent[]>(eventsKey, (old) => [
				...(old ?? []),
				buildOptimisticEvent(eventType, payload),
			]);

			// 4. Optimistic: update session summary + status
			queryClient.setQueryData<SessionSummaryData>(sessionKey, (old) => {
				if (!old) {
					return old;
				}

				const nextSummary = old.summary
					? buildOptimisticSessionSummary(old.summary, eventType, payload)
					: old.summary;

				const nextStatus =
					changesStatus && old.status
						? deriveOptimisticStatus(old.status, eventType)
						: old.status;

				return { ...old, summary: nextSummary, status: nextStatus };
			});

			// 5. Optimistic: move session between active/paused lists
			if (changesStatus) {
				optimisticListStatusUpdate(
					queryClient,
					sessionId,
					eventType,
					activeListKey,
					pausedListKey
				);
			}

			return { previousSession, previousEvents, previousLists };
		},

		onError: (
			_error: unknown,
			_variables: TVariables,
			context: SnapshotContext | undefined
		) => {
			if (context) {
				restoreSnapshots(queryClient, [
					context.previousSession,
					context.previousEvents,
					context.previousLists,
				]);
			}
		},

		onSettled: async () => {
			await invalidateTargets(queryClient, [
				{ queryKey: sessionKey },
				{ queryKey: eventsKey },
				{ filters: { queryKey: allListsKey } },
			]);
		},
	};
}

// ---------------------------------------------------------------------------
// List status update helper
// ---------------------------------------------------------------------------

function optimisticListStatusUpdate(
	queryClient: QueryClient,
	sessionId: string,
	eventType: string,
	activeListKey: QueryKey,
	pausedListKey: QueryKey
) {
	const newStatus = deriveOptimisticStatus("active", eventType);
	const [fromKey, toKey] =
		newStatus === "paused"
			? [activeListKey, pausedListKey]
			: [pausedListKey, activeListKey];

	// Find the session item from the source list
	const fromData = queryClient.getQueryData<ListData>(fromKey);
	const sessionItem = fromData?.items?.find((item) => item.id === sessionId);

	// Remove from source list
	queryClient.setQueryData<ListData>(fromKey, (old) => {
		if (!old?.items) {
			return old;
		}
		return {
			...old,
			items: old.items.filter((item) => item.id !== sessionId),
		};
	});

	// Add to target list
	if (sessionItem) {
		queryClient.setQueryData<ListData>(toKey, (old) => ({
			...(old ?? { nextCursor: undefined }),
			items: [{ ...sessionItem, status: newStatus }, ...(old?.items ?? [])],
		}));
	}
}
