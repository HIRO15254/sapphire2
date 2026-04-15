import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
	cancelTargets,
	invalidateTargets,
	type OptimisticTarget,
	type QuerySnapshot,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc } from "@/utils/trpc";

export type LiveSessionType = "cash_game" | "tournament";
export type LiveSessionStatus = "active" | "paused" | "completed";
export type LiveSessionEventType =
	| "all_in"
	| "chips_add_remove"
	| "memo"
	| "player_join"
	| "player_leave"
	| "purchase_chips"
	| "session_end"
	| "session_pause"
	| "session_resume"
	| "session_start"
	| "update_stack"
	| "update_tournament_info";

export interface LiveSessionEvent {
	eventType: LiveSessionEventType;
	id: string;
	occurredAt: string | Date;
	payload: unknown;
}

export interface LiveSessionTablePlayerItem {
	id: string;
	isActive: boolean;
	joinedAt: string | Date;
	leftAt: string | Date | null;
	player: {
		id: string;
		memo: string | null;
		name: string;
	};
	seatPosition: number | null;
}

export interface LiveSessionPlayersData {
	items: LiveSessionTablePlayerItem[];
}

export interface LiveSessionSummaryData {
	summary?: Record<string, unknown>;
	[key: string]: unknown;
}

export interface LiveSessionDetailData extends LiveSessionSummaryData {
	currencyId?: string | null;
	events?: LiveSessionEvent[];
	heroSeatPosition?: number | null;
	id?: string;
	status?: LiveSessionStatus;
	tablePlayers?: LiveSessionTablePlayerItem[];
}

export interface LiveSessionListItem {
	averageStack?: number | null;
	eventCount?: number;
	id: string;
	latestStackAmount?: number | null;
	remainingPlayers?: number | null;
	status: LiveSessionStatus;
	updatedAt?: string | Date;
	[key: string]: unknown;
}

export interface LiveSessionListData<
	TItem extends LiveSessionListItem = LiveSessionListItem,
> {
	items: TItem[];
	nextCursor?: string;
}

export interface LiveSessionCacheRefs {
	detailKey: QueryKey;
	eventsKey: QueryKey;
	historicalTargets: {
		currencyList: OptimisticTarget;
		sessionList: OptimisticTarget;
	};
	listKeys: {
		active: QueryKey;
		all: QueryKey;
		paused: QueryKey;
	};
	playersKey: QueryKey;
	sessionId: string;
	sessionType: LiveSessionType;
}

export interface LiveSessionCacheSnapshot {
	detail: QuerySnapshot;
	events: QuerySnapshot;
	listActive: QuerySnapshot;
	listAll: QuerySnapshot;
	listPaused: QuerySnapshot;
	players: QuerySnapshot;
}

interface InvalidateLiveSessionCacheOptions {
	includeDetail?: boolean;
	includeEvents?: boolean;
	includeHistorical?: boolean;
	includeLists?: boolean;
	includePlayers?: boolean;
}

function getSessionEventQueryInput(
	sessionId: string,
	sessionType: LiveSessionType
) {
	return sessionType === "cash_game"
		? { liveCashGameSessionId: sessionId }
		: { liveTournamentSessionId: sessionId };
}

function getTablePlayersQueryInput(
	sessionId: string,
	sessionType: LiveSessionType
) {
	return sessionType === "cash_game"
		? { liveCashGameSessionId: sessionId }
		: { liveTournamentSessionId: sessionId };
}

function getDetailKey(
	sessionId: string,
	sessionType: LiveSessionType
): QueryKey {
	return sessionType === "cash_game"
		? trpc.liveCashGameSession.getById.queryOptions({
				id: sessionId,
			}).queryKey
		: trpc.liveTournamentSession.getById.queryOptions({
				id: sessionId,
			}).queryKey;
}

function getListKeys(sessionType: LiveSessionType) {
	return sessionType === "cash_game"
		? {
				active: trpc.liveCashGameSession.list.queryOptions({
					status: "active",
					limit: 1,
				}).queryKey,
				all: trpc.liveCashGameSession.list.queryOptions({}).queryKey,
				paused: trpc.liveCashGameSession.list.queryOptions({
					status: "paused",
					limit: 1,
				}).queryKey,
			}
		: {
				active: trpc.liveTournamentSession.list.queryOptions({
					status: "active",
					limit: 1,
				}).queryKey,
				all: trpc.liveTournamentSession.list.queryOptions({}).queryKey,
				paused: trpc.liveTournamentSession.list.queryOptions({
					status: "paused",
					limit: 1,
				}).queryKey,
			};
}

export function getLiveSessionCacheRefs({
	sessionId,
	sessionType,
}: {
	sessionId: string;
	sessionType: LiveSessionType;
}): LiveSessionCacheRefs {
	return {
		detailKey: getDetailKey(sessionId, sessionType),
		eventsKey: trpc.sessionEvent.list.queryOptions(
			getSessionEventQueryInput(sessionId, sessionType)
		).queryKey,
		historicalTargets: {
			currencyList: {
				queryKey: trpc.currency.list.queryOptions().queryKey,
			},
			sessionList: {
				queryKey: trpc.session.list.queryOptions({}).queryKey,
			},
		},
		listKeys: getListKeys(sessionType),
		playersKey: trpc.sessionTablePlayer.list.queryOptions(
			getTablePlayersQueryInput(sessionId, sessionType)
		).queryKey,
		sessionId,
		sessionType,
	};
}

function getOptimisticTargets(
	refs: LiveSessionCacheRefs,
	{
		includeDetail = true,
		includeEvents = true,
		includeLists = true,
		includePlayers = true,
	}: InvalidateLiveSessionCacheOptions = {}
): OptimisticTarget[] {
	const targets: OptimisticTarget[] = [];

	if (includeDetail) {
		targets.push({ queryKey: refs.detailKey });
	}
	if (includeEvents) {
		targets.push({ queryKey: refs.eventsKey });
	}
	if (includePlayers) {
		targets.push({ queryKey: refs.playersKey });
	}
	if (includeLists) {
		targets.push(
			{ queryKey: refs.listKeys.all },
			{ queryKey: refs.listKeys.active },
			{ queryKey: refs.listKeys.paused }
		);
	}

	return targets;
}

function buildHistoricalTargets(
	refs: LiveSessionCacheRefs,
	currencyId: string | null | undefined
): OptimisticTarget[] {
	const targets = [
		refs.historicalTargets.sessionList,
		refs.historicalTargets.currencyList,
	];

	if (currencyId) {
		targets.push({
			queryKey: trpc.currencyTransaction.listByCurrency.queryOptions({
				currencyId,
			}).queryKey,
		});
	}

	return targets;
}

function updateArrayItem<T extends { id: string }>(
	items: T[],
	id: string,
	updater: (item: T) => T
) {
	return items.map((item) => (item.id === id ? updater(item) : item));
}

function resolveCurrencyId(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	currencyId?: string | null
) {
	if (currencyId !== undefined) {
		return currencyId;
	}

	const detail =
		queryClient.getQueryData<LiveSessionDetailData>(refs.detailKey) ?? null;

	return detail?.currencyId ?? null;
}

function getListFallbackItem(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	status: LiveSessionStatus
): LiveSessionListItem {
	const allList = queryClient.getQueryData<LiveSessionListData>(
		refs.listKeys.all
	);
	const currentListItem = allList?.items.find(
		(item) => item.id === refs.sessionId
	);

	if (currentListItem) {
		return {
			...currentListItem,
			status,
		};
	}

	const detail =
		queryClient.getQueryData<LiveSessionDetailData>(refs.detailKey) ?? null;

	return {
		currencyId: detail?.currencyId ?? null,
		id: refs.sessionId,
		status,
		updatedAt:
			typeof detail?.updatedAt === "string" || detail?.updatedAt instanceof Date
				? detail.updatedAt
				: undefined,
	};
}

function applyChipsAddRemoveSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	if (payload.type !== "add" || typeof payload.amount !== "number") {
		return;
	}

	summary.totalBuyIn =
		(typeof summary.totalBuyIn === "number" ? summary.totalBuyIn : 0) +
		payload.amount;
	summary.addonCount =
		(typeof summary.addonCount === "number" ? summary.addonCount : 0) + 1;
}

function applyPurchaseChipsSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	if (typeof payload.cost !== "number") {
		return;
	}

	summary.rebuyCount =
		(typeof summary.rebuyCount === "number" ? summary.rebuyCount : 0) + 1;
	summary.rebuyCost =
		(typeof summary.rebuyCost === "number" ? summary.rebuyCost : 0) +
		payload.cost;
}

function applySessionEndSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	if (typeof payload.cashOutAmount === "number") {
		summary.cashOut = payload.cashOutAmount;
		const totalBuyIn =
			typeof summary.totalBuyIn === "number" ? summary.totalBuyIn : 0;
		summary.profitLoss = payload.cashOutAmount - totalBuyIn;
	}

	if (payload.beforeDeadline === false) {
		if (typeof payload.placement === "number") {
			summary.placement = payload.placement;
		}

		if (typeof payload.totalEntries === "number") {
			summary.totalEntries = payload.totalEntries;
		}
	}

	if (typeof payload.prizeMoney === "number") {
		const bountyPrizes =
			typeof payload.bountyPrizes === "number" ? payload.bountyPrizes : 0;
		summary.prizeMoney = payload.prizeMoney;
		summary.bountyPrizes = bountyPrizes;
		summary.profitLoss = payload.prizeMoney + bountyPrizes;
	}
}

function applySessionStartSummary(
	summary: Record<string, unknown>,
	payload: Record<string, unknown>
) {
	if (typeof payload.buyInAmount !== "number") {
		return;
	}

	summary.totalBuyIn =
		(typeof summary.totalBuyIn === "number" ? summary.totalBuyIn : 0) +
		payload.buyInAmount;
}

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
	if (typeof payload.remainingPlayers === "number") {
		summary.remainingPlayers = payload.remainingPlayers;
	}

	if (typeof payload.totalEntries === "number") {
		summary.totalEntries = payload.totalEntries;
	}

	if (typeof payload.averageStack === "number") {
		summary.averageStack = payload.averageStack;
	}
}

const SUMMARY_APPLIERS: Partial<
	Record<
		LiveSessionEventType,
		(summary: Record<string, unknown>, payload: Record<string, unknown>) => void
	>
> = {
	chips_add_remove: applyChipsAddRemoveSummary,
	purchase_chips: applyPurchaseChipsSummary,
	session_end: applySessionEndSummary,
	session_start: applySessionStartSummary,
	update_stack: applyUpdateStackSummary,
	update_tournament_info: applyUpdateTournamentInfoSummary,
};

function buildOptimisticSessionSummary(
	summary: Record<string, unknown>,
	eventType: LiveSessionEventType,
	payload: Record<string, unknown>,
	occurredAt?: number
) {
	const nextSummary = { ...summary };
	const applySummary = SUMMARY_APPLIERS[eventType];
	applySummary?.(nextSummary, payload);

	if (occurredAt) {
		nextSummary.lastUpdatedAt = occurredAt;
	}

	return nextSummary;
}

function patchSummaryForEvent(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	eventType: LiveSessionEventType,
	payload: unknown,
	occurredAt?: number
) {
	if (!payload || typeof payload !== "object") {
		return;
	}

	patchLiveSessionDetail(queryClient, refs, (old) => {
		if (!old?.summary) {
			return old;
		}

		return {
			...old,
			summary: buildOptimisticSessionSummary(
				old.summary,
				eventType,
				payload as Record<string, unknown>,
				occurredAt
			),
		};
	});

	queryClient.setQueryData<LiveSessionListData>(refs.listKeys.all, (old) => {
		if (!old) {
			return old;
		}

		const typedPayload = payload as Record<string, unknown>;

		return {
			...old,
			items: old.items.map((item) => {
				if (item.id !== refs.sessionId) {
					return item;
				}

				const nextItem = { ...item };

				if (
					eventType === "update_stack" &&
					typeof typedPayload.stackAmount === "number"
				) {
					nextItem.latestStackAmount = typedPayload.stackAmount;
				}

				if (eventType === "update_tournament_info") {
					if (typeof typedPayload.remainingPlayers === "number") {
						nextItem.remainingPlayers = typedPayload.remainingPlayers;
					}
					if (typeof typedPayload.averageStack === "number") {
						nextItem.averageStack = typedPayload.averageStack;
					}
				}

				return nextItem;
			}),
		};
	});
}

export async function cancelLiveSessionCaches(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	options?: InvalidateLiveSessionCacheOptions
) {
	await cancelTargets(queryClient, getOptimisticTargets(refs, options));
}

export function snapshotLiveSessionCaches(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs
): LiveSessionCacheSnapshot {
	return {
		detail: snapshotQuery(queryClient, refs.detailKey),
		events: snapshotQuery(queryClient, refs.eventsKey),
		listActive: snapshotQuery(queryClient, refs.listKeys.active),
		listAll: snapshotQuery(queryClient, refs.listKeys.all),
		listPaused: snapshotQuery(queryClient, refs.listKeys.paused),
		players: snapshotQuery(queryClient, refs.playersKey),
	};
}

export function restoreLiveSessionCaches(
	queryClient: QueryClient,
	snapshot: LiveSessionCacheSnapshot | null | undefined
) {
	if (!snapshot) {
		return;
	}

	restoreSnapshots(queryClient, [
		snapshot.detail,
		snapshot.events,
		snapshot.players,
		snapshot.listAll,
		snapshot.listActive,
		snapshot.listPaused,
	]);
}

export async function invalidateLiveSessionCaches(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	{
		currencyId,
		includeDetail = true,
		includeEvents = true,
		includeHistorical = false,
		includeLists = true,
		includePlayers = true,
	}: InvalidateLiveSessionCacheOptions & {
		currencyId?: string | null;
	} = {}
) {
	const targets = getOptimisticTargets(refs, {
		includeDetail,
		includeEvents,
		includeLists,
		includePlayers,
	});

	if (includeHistorical) {
		targets.push(
			...buildHistoricalTargets(
				refs,
				resolveCurrencyId(queryClient, refs, currencyId)
			)
		);
	}

	await invalidateTargets(queryClient, targets);
}

export function patchLiveSessionDetail(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	updater: (
		session: LiveSessionDetailData | undefined
	) => LiveSessionDetailData | undefined
) {
	queryClient.setQueryData<LiveSessionDetailData>(refs.detailKey, (old) =>
		updater(old)
	);
}

export function patchLiveSessionLists(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	updater: (item: LiveSessionListItem) => LiveSessionListItem
) {
	queryClient.setQueryData<LiveSessionListData>(refs.listKeys.all, (old) => {
		if (!old) {
			return old;
		}

		return {
			...old,
			items: old.items.map((item) =>
				item.id === refs.sessionId ? updater(item) : item
			),
		};
	});
}

export function transitionLiveSessionStatus(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	status: Extract<LiveSessionStatus, "active" | "paused">
) {
	patchLiveSessionDetail(queryClient, refs, (old) =>
		old ? { ...old, status } : old
	);

	patchLiveSessionLists(queryClient, refs, (item) => ({
		...item,
		status,
	}));

	const fallbackItem = getListFallbackItem(queryClient, refs, status);

	queryClient.setQueryData<LiveSessionListData>(refs.listKeys.active, (old) =>
		old
			? {
					...old,
					items: status === "active" ? [fallbackItem] : [],
				}
			: old
	);

	queryClient.setQueryData<LiveSessionListData>(refs.listKeys.paused, (old) =>
		old
			? {
					...old,
					items: status === "paused" ? [fallbackItem] : [],
				}
			: old
	);
}

export function patchLiveSessionEvents(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	updater: (events: LiveSessionEvent[]) => LiveSessionEvent[]
) {
	queryClient.setQueryData<LiveSessionEvent[]>(refs.eventsKey, (old) =>
		updater(old ?? [])
	);

	patchLiveSessionDetail(queryClient, refs, (old) =>
		old
			? {
					...old,
					events: updater((old.events ?? []) as LiveSessionEvent[]),
				}
			: old
	);
}

export function patchLiveSessionPlayers(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	updater: (
		players: LiveSessionTablePlayerItem[]
	) => LiveSessionTablePlayerItem[]
) {
	queryClient.setQueryData<LiveSessionPlayersData>(refs.playersKey, (old) =>
		old
			? {
					...old,
					items: updater(old.items),
				}
			: old
	);

	patchLiveSessionDetail(queryClient, refs, (old) =>
		old
			? {
					...old,
					tablePlayers: updater(
						(old.tablePlayers ?? []) as LiveSessionTablePlayerItem[]
					),
				}
			: old
	);
}

export function applyOptimisticLiveSessionEvent(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	{
		event,
		eventType,
		occurredAt,
		payload,
	}: {
		event?: LiveSessionEvent;
		eventType: LiveSessionEventType;
		occurredAt?: number;
		payload: unknown;
	}
) {
	const optimisticEvent: LiveSessionEvent = event ?? {
		eventType,
		id: `optimistic-${Date.now()}`,
		occurredAt: new Date(
			occurredAt ? occurredAt * 1000 : Date.now()
		).toISOString(),
		payload,
	};

	if (event) {
		patchLiveSessionEvents(queryClient, refs, (events) =>
			updateArrayItem(events, event.id, (currentEvent) => ({
				...currentEvent,
				occurredAt:
					occurredAt !== undefined
						? new Date(occurredAt * 1000).toISOString()
						: currentEvent.occurredAt,
				payload,
			}))
		);
	} else {
		patchLiveSessionEvents(queryClient, refs, (events) => [
			...events,
			optimisticEvent,
		]);
	}

	if (eventType === "session_pause") {
		transitionLiveSessionStatus(queryClient, refs, "paused");
	}

	if (eventType === "session_resume") {
		transitionLiveSessionStatus(queryClient, refs, "active");
	}

	patchSummaryForEvent(queryClient, refs, eventType, payload, occurredAt);
}

export function getHistoricalInvalidationTargets(
	queryClient: QueryClient,
	refs: LiveSessionCacheRefs,
	currencyId?: string | null
) {
	return buildHistoricalTargets(
		refs,
		resolveCurrencyId(queryClient, refs, currencyId)
	);
}
