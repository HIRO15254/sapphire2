import type { MixGameGroup } from "@sapphire2/db/schemas/game";
import {
	useInfiniteQuery,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { SessionFilterValues } from "@/features/sessions/utils/session-filters-helpers";
import type {
	SessionBlindLevelInput,
	SessionFormValues,
} from "@/features/sessions/utils/session-form-helpers";
import { resolveDateRange } from "@/shared/lib/period-filter";
import {
	cancelTargets,
	invalidateTargets,
	prependInfiniteQueryItem,
	restoreSnapshots,
	snapshotQuery,
	updateInfiniteQueryItems,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export type {
	CashGameFormValues,
	SessionFormValues,
	TournamentFormValues,
} from "@/features/sessions/utils/session-form-helpers";

export interface SessionItem {
	beforeDeadline: boolean | null;
	/**
	 * Tournament blind structure (empty for cash / structureless sessions).
	 * Optional because a response from an older API build — or a cached
	 * pre-migration entry — can omit it; consumers must tolerate `undefined`.
	 */
	blindLevels?: SessionBlindLevelInput[];
	bountyPrizes: number | null;
	breakMinutes: number | null;
	buyIn: number | null;
	// Cash snapshot scalars (used by the wizard edit pre-fill).
	cashAnte: number | null;
	cashAnteType: string | null;
	cashBlind1: number | null;
	cashBlind3: number | null;
	cashMaxBuyIn: number | null;
	cashMinBuyIn: number | null;
	/** Frozen mix-game groups (cash). Optional: older cached shapes omit it. */
	cashMixGames?: MixGameGroup[] | null;
	cashOut: number | null;
	cashTableSize: number | null;
	cashVariant: string | null;
	/** Σ cost × count across this session's chip purchases. */
	chipPurchaseCost: number;
	/** Rule-defined chip purchases with their result counts. */
	chipPurchases: Array<{
		chips: number;
		cost: number;
		count: number;
		id: string;
		name: string;
		sortOrder: number;
	}>;
	createdAt: string;
	currencyId: string | null;
	currencyName: string | null;
	currencyUnit: string | null;
	endedAt: string | null;
	entryFee: number | null;
	evCashOut: number | null;
	evDiff: number | null;
	evProfitLoss: number | null;
	id: string;
	liveCashGameSessionId: string | null;
	liveTournamentSessionId: string | null;
	memo: string | null;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number | null;
	ringGameBlind2: number | null;
	ringGameId: string | null;
	ringGameName: string | null;
	roomId: string | null;
	roomName: string | null;
	sessionDate: string;
	// CTI fields — always present from session.list since Phase 1 DB migration
	source: string;
	startedAt: string | null;
	status: string;
	tags: Array<{ id: string; name: string }>;
	totalEntries: number | null;
	tournamentBountyAmount: number | null;
	tournamentBuyIn: number | null;
	tournamentId: string | null;
	tournamentName: string | null;
	// Tournament snapshot scalars (used by the wizard edit pre-fill).
	tournamentStartingStack: number | null;
	tournamentTableSize: number | null;
	tournamentVariant: string | null;
	type: string;
}

function timeToUnix(
	sessionDate: string,
	time: string | undefined
): number | undefined {
	if (!time) {
		return undefined;
	}
	return Math.floor(new Date(`${sessionDate}T${time}`).getTime() / 1000);
}

const DAY_SECONDS = 24 * 60 * 60;

/**
 * Converts the form's start/end clock times — both entered against a single
 * `sessionDate` with no separate end-date field — into Unix seconds, rolling the
 * end forward 24h when it lands strictly before the start (the session crossed
 * midnight, e.g. 22:00 → 02:00). Without this the end was stored ~20h before the
 * start, so the UI showed a negative duration and the server clamped play time to
 * 0, dropping the session out of every play-time statistic (SA2-157). Equal
 * start/end is treated as a 0-length span, never a 24h one.
 */
function computeSessionTimes(
	sessionDate: string,
	startTime: string | undefined,
	endTime: string | undefined
): { startedAt: number | undefined; endedAt: number | undefined } {
	const startedAt = timeToUnix(sessionDate, startTime);
	let endedAt = timeToUnix(sessionDate, endTime);
	if (startedAt !== undefined && endedAt !== undefined && endedAt < startedAt) {
		endedAt += DAY_SECONDS;
	}
	return { startedAt, endedAt };
}

export function buildCreatePayload(values: SessionFormValues) {
	const sessionDate = Math.floor(new Date(values.sessionDate).getTime() / 1000);
	const { startedAt, endedAt } = computeSessionTimes(
		values.sessionDate,
		values.startTime,
		values.endTime
	);
	const common = {
		sessionDate,
		startedAt,
		endedAt,
		breakMinutes: values.breakMinutes,
		memo: values.memo,
		tagIds: values.tagIds,
		roomId: values.roomId,
		currencyId: values.currencyId,
	};
	if (values.type === "cash_game") {
		return {
			...common,
			type: "cash_game" as const,
			buyIn: values.buyIn,
			cashOut: values.cashOut,
			evCashOut: values.evCashOut,
			ruleName: values.ruleName,
			variant: values.variant,
			blind1: values.blind1,
			blind2: values.blind2,
			blind3: values.blind3,
			ante: values.ante,
			anteType: values.anteType as "none" | "all" | "bb" | undefined,
			tableSize: values.tableSize,
			minBuyIn: values.minBuyIn,
			maxBuyIn: values.maxBuyIn,
			mixGames: values.mixGames,
			ringGameId: values.ringGameId,
		};
	}
	return {
		...common,
		type: "tournament" as const,
		tournamentBuyIn: values.tournamentBuyIn,
		entryFee: values.entryFee,
		beforeDeadline: values.beforeDeadline,
		placement: values.placement,
		totalEntries: values.totalEntries,
		prizeMoney: values.prizeMoney,
		bountyPrizes: values.bountyPrizes,
		ruleName: values.ruleName,
		variant: values.variant,
		startingStack: values.startingStack,
		bountyAmount: values.bountyAmount,
		tableSize: values.tableSize,
		blindLevels: values.blindLevels,
		chipPurchases: values.chipPurchases,
		tournamentId: values.tournamentId,
	};
}

export function buildLiveLinkedUpdatePayload(
	values: SessionFormValues & { id: string }
) {
	return {
		id: values.id,
		memo: values.memo,
		tagIds: values.tagIds,
		roomId: values.roomId ?? null,
		currencyId: values.currencyId ?? null,
	};
}

export function buildUpdatePayload(values: SessionFormValues & { id: string }) {
	const { startedAt, endedAt } = computeSessionTimes(
		values.sessionDate,
		values.startTime,
		values.endTime
	);
	const common = {
		id: values.id,
		sessionDate: Math.floor(new Date(values.sessionDate).getTime() / 1000),
		startedAt: startedAt ?? null,
		endedAt: endedAt ?? null,
		breakMinutes: values.breakMinutes ?? null,
		memo: values.memo,
		ruleName: values.ruleName,
		tagIds: values.tagIds,
		roomId: values.roomId ?? null,
		currencyId: values.currencyId ?? null,
	};
	if (values.type === "cash_game") {
		return {
			...common,
			buyIn: values.buyIn,
			cashOut: values.cashOut,
			evCashOut: values.evCashOut ?? null,
			variant: values.variant,
			blind1: values.blind1,
			blind2: values.blind2,
			blind3: values.blind3,
			ante: values.ante,
			anteType: values.anteType as "none" | "all" | "bb" | undefined,
			tableSize: values.tableSize,
			minBuyIn: values.minBuyIn ?? null,
			maxBuyIn: values.maxBuyIn ?? null,
			mixGames: values.mixGames ?? null,
			ringGameId: values.ringGameId ?? null,
		};
	}
	return {
		...common,
		tournamentBuyIn: values.tournamentBuyIn,
		entryFee: values.entryFee,
		beforeDeadline: values.beforeDeadline ?? null,
		placement: values.placement ?? null,
		totalEntries: values.totalEntries ?? null,
		prizeMoney: values.prizeMoney,
		bountyPrizes: values.bountyPrizes,
		variant: values.variant,
		startingStack: values.startingStack ?? null,
		bountyAmount: values.bountyAmount ?? null,
		tableSize: values.tableSize ?? null,
		blindLevels: values.blindLevels,
		chipPurchases: values.chipPurchases,
		tournamentId: values.tournamentId ?? null,
	};
}

export function buildOptimisticItem(
	newSession: SessionFormValues
): SessionItem {
	const item: SessionItem = {
		id: `temp-${Date.now()}`,
		type: newSession.type,
		sessionDate: newSession.sessionDate,
		buyIn: null,
		cashOut: null,
		evCashOut: null,
		evProfitLoss: null,
		evDiff: null,
		tournamentBuyIn: null,
		entryFee: null,
		beforeDeadline: null,
		placement: null,
		totalEntries: null,
		prizeMoney: null,
		bountyPrizes: null,
		blindLevels: [],
		chipPurchases: [],
		chipPurchaseCost: 0,
		breakMinutes: newSession.breakMinutes ?? null,
		profitLoss: 0,
		startedAt: null,
		endedAt: null,
		memo: newSession.memo ?? null,
		roomId: newSession.roomId ?? null,
		roomName: null,
		ringGameId: null,
		ringGameBlind2: null,
		ringGameName: null,
		tournamentId: null,
		tournamentName: null,
		currencyId: newSession.currencyId ?? null,
		currencyName: null,
		currencyUnit: null,
		createdAt: new Date().toISOString(),
		// Manual entries are always source='manual' and status='completed'
		source: "manual",
		status: "completed",
		liveCashGameSessionId: null,
		liveTournamentSessionId: null,
		tags: [],
		cashAnte: null,
		cashAnteType: null,
		cashBlind1: null,
		cashBlind3: null,
		cashMaxBuyIn: null,
		cashMinBuyIn: null,
		cashMixGames: null,
		cashTableSize: null,
		cashVariant: null,
		tournamentBountyAmount: null,
		tournamentStartingStack: null,
		tournamentTableSize: null,
		tournamentVariant: null,
	};
	if (newSession.type === "cash_game") {
		item.buyIn = newSession.buyIn;
		item.cashOut = newSession.cashOut;
		item.evCashOut = newSession.evCashOut ?? null;
		item.profitLoss = newSession.cashOut - newSession.buyIn;
		if (newSession.evCashOut !== undefined) {
			item.evProfitLoss = newSession.evCashOut - newSession.buyIn;
			item.evDiff = item.evProfitLoss - item.profitLoss;
		}
	} else {
		item.tournamentBuyIn = newSession.tournamentBuyIn;
		item.entryFee = newSession.entryFee ?? null;
		item.beforeDeadline = newSession.beforeDeadline ?? null;
	}
	return item;
}

function cashSnapshotDefaults(session: SessionItem) {
	if (session.type !== "cash_game") {
		return {};
	}
	return {
		ruleName: session.ringGameName ?? undefined,
		variant: session.cashVariant ?? undefined,
		blind1: session.cashBlind1 ?? undefined,
		blind2: session.ringGameBlind2 ?? undefined,
		blind3: session.cashBlind3 ?? undefined,
		ante: session.cashAnte ?? undefined,
		anteType: session.cashAnteType ?? undefined,
		minBuyIn: session.cashMinBuyIn ?? undefined,
		maxBuyIn: session.cashMaxBuyIn ?? undefined,
		tableSize: session.cashTableSize ?? undefined,
		mixGames: session.cashMixGames ?? undefined,
	};
}

function tournamentSnapshotDefaults(session: SessionItem) {
	if (session.type !== "tournament") {
		return {};
	}
	return {
		ruleName: session.tournamentName ?? undefined,
		variant: session.tournamentVariant ?? undefined,
		tableSize: session.tournamentTableSize ?? undefined,
		startingStack: session.tournamentStartingStack ?? undefined,
		bountyAmount: session.tournamentBountyAmount ?? undefined,
	};
}

export function buildEditDefaults(session: SessionItem) {
	return {
		type: session.type as "cash_game" | "tournament",
		sessionDate: formatDateForInput(session.sessionDate),
		buyIn: session.buyIn ?? 0,
		cashOut: session.cashOut ?? 0,
		evCashOut: session.evCashOut ?? undefined,
		tournamentBuyIn: session.tournamentBuyIn ?? 0,
		entryFee: session.entryFee ?? undefined,
		beforeDeadline: session.beforeDeadline ?? undefined,
		placement: session.placement ?? undefined,
		totalEntries: session.totalEntries ?? undefined,
		prizeMoney: session.prizeMoney ?? undefined,
		bountyPrizes: session.bountyPrizes ?? undefined,
		chipPurchases: session.chipPurchases.map((cp) => ({
			name: cp.name,
			cost: cp.cost,
			chips: cp.chips,
			count: cp.count,
		})),
		// Tournament blind structure — hydrate the Rules-step editor from the
		// session's own frozen levels so editing keeps (and can amend) the
		// saved structure instead of starting blank.
		blindLevels: (session.blindLevels ?? []).map((level) => ({
			isBreak: level.isBreak,
			blind1: level.blind1,
			blind2: level.blind2,
			blind3: level.blind3,
			ante: level.ante,
			minutes: level.minutes,
		})),
		startTime: formatTimeFromDate(session.startedAt),
		endTime: formatTimeFromDate(session.endedAt),
		breakMinutes: session.breakMinutes ?? undefined,
		memo: session.memo ?? undefined,
		tagIds: session.tags.map((t) => t.id),
		roomId: session.roomId ?? undefined,
		ringGameId: session.ringGameId ?? undefined,
		tournamentId: session.tournamentId ?? undefined,
		currencyId: session.currencyId ?? undefined,
		// Snapshot scalars — pre-fill the Rules step from the frozen detail
		// columns so editing keeps the same rule shape unless the user
		// overrides it explicitly.
		...cashSnapshotDefaults(session),
		...tournamentSnapshotDefaults(session),
	};
}

export function filtersToListInput(filters: SessionFilterValues) {
	// Reuse the statistics period resolver: preset windows snap to UTC day
	// boundaries, `custom` passes the from/to bounds straight through (SA2-74).
	const range = resolveDateRange({
		period: filters.period ?? "all",
		from: filters.from,
		to: filters.to,
	});
	return {
		type: filters.type,
		roomId: filters.roomId,
		currencyId: filters.currencyId,
		dateFrom: range.dateFrom,
		dateTo: range.dateTo,
	};
}

// sessionDate is stored/returned as UTC midnight and the create/update payloads
// re-encode a date-only string as UTC midnight, so the edit form must read back
// the UTC calendar day. Local getters shift the day back one for users west of
// UTC, and saving that value drifts the stored date one day earlier on every
// edit (SA2-145).
export function formatDateForInput(date: string): string {
	const d = new Date(date);
	const year = d.getUTCFullYear();
	const month = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function formatTimeFromDate(date: string | null): string | undefined {
	if (!date) {
		return undefined;
	}
	const d = new Date(date);
	const hours = String(d.getHours()).padStart(2, "0");
	const minutes = String(d.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

export function useSessions(filters: SessionFilterValues) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const listInput = filtersToListInput(filters);
	const sessionListOptions = trpc.session.list.infiniteQueryOptions(listInput, {
		getNextPageParam: (lastPage) => lastPage.nextCursor,
	});
	const sessionListKey = sessionListOptions.queryKey;

	const sessionsQuery = useInfiniteQuery(sessionListOptions);
	const sessions =
		sessionsQuery.data?.pages.flatMap((page) => page.items) ?? [];

	const fetchNextPage = () => {
		if (sessionsQuery.hasNextPage && !sessionsQuery.isFetchingNextPage) {
			sessionsQuery.fetchNextPage();
		}
	};

	const tagsQuery = useQuery(trpc.sessionTag.list.queryOptions());
	const availableTags = tagsQuery.data ?? [];

	const createTagMutation = useMutation({
		mutationFn: (name: string) => trpcClient.sessionTag.create.mutate({ name }),
		onSettled: () => {
			invalidateTargets(queryClient, [
				{ queryKey: trpc.sessionTag.list.queryOptions().queryKey },
			]);
		},
	});

	const handleCreateTag = async (name: string) => {
		const result = await createTagMutation.mutateAsync(name);
		return { id: result.id, name: result.name };
	};

	const createMutation = useMutation({
		mutationFn: (values: SessionFormValues) =>
			trpcClient.session.create.mutate(buildCreatePayload(values)),
		onMutate: async (newSession) => {
			await cancelTargets(queryClient, [{ queryKey: sessionListKey }]);
			const previous = snapshotQuery(queryClient, sessionListKey);
			prependInfiniteQueryItem<SessionItem>(
				queryClient,
				sessionListKey,
				buildOptimisticItem(newSession)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: sessionListKey }]);
		},
	});

	const updateMutation = useMutation({
		mutationFn: (
			values: SessionFormValues & { id: string; isLiveLinked?: boolean }
		) =>
			trpcClient.session.update.mutate(
				values.isLiveLinked
					? buildLiveLinkedUpdatePayload(values)
					: buildUpdatePayload(values)
			),
		onMutate: async (updated) => {
			await cancelTargets(queryClient, [{ queryKey: sessionListKey }]);
			const previous = snapshotQuery(queryClient, sessionListKey);
			updateInfiniteQueryItems<SessionItem>(
				queryClient,
				sessionListKey,
				(items) =>
					items.map((s) =>
						s.id === updated.id
							? {
									...s,
									sessionDate: updated.sessionDate,
									memo: updated.memo ?? null,
								}
							: s
					)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: sessionListKey }]);
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.session.delete.mutate({ id }),
		onMutate: async (id) => {
			await cancelTargets(queryClient, [{ queryKey: sessionListKey }]);
			const previous = snapshotQuery(queryClient, sessionListKey);
			updateInfiniteQueryItems<SessionItem>(
				queryClient,
				sessionListKey,
				(items) => items.filter((s) => s.id !== id)
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			restoreSnapshots(queryClient, [context?.previous]);
		},
		onSettled: () => {
			invalidateTargets(queryClient, [{ queryKey: sessionListKey }]);
		},
	});

	const reopenMutation = useMutation({
		mutationFn: (liveCashGameSessionId: string) =>
			trpcClient.liveCashGameSession.reopen.mutate({
				id: liveCashGameSessionId,
			}),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [
				{ queryKey: sessionListKey },
				{
					queryKey: trpc.liveCashGameSession.list.queryOptions({}).queryKey,
				},
				{
					queryKey: trpc.liveCashGameSession.list.queryOptions({
						status: "active",
						limit: 1,
					}).queryKey,
				},
				{
					queryKey: trpc.liveCashGameSession.list.queryOptions({
						status: "paused",
						limit: 1,
					}).queryKey,
				},
			]);
			await navigate({ to: "/active-session" });
		},
	});

	return {
		sessions,
		availableTags,
		isLoading: sessionsQuery.isLoading,
		hasNextPage: sessionsQuery.hasNextPage,
		isFetchingNextPage: sessionsQuery.isFetchingNextPage,
		fetchNextPage,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		create: (values: SessionFormValues) => createMutation.mutateAsync(values),
		update: (
			values: SessionFormValues & { id: string; isLiveLinked?: boolean }
		) => updateMutation.mutateAsync(values),
		delete: (id: string) => {
			deleteMutation.mutate(id);
		},
		reopen: (liveCashGameSessionId: string) => {
			reopenMutation.mutate(liveCashGameSessionId);
		},
		createTag: handleCreateTag,
	};
}
