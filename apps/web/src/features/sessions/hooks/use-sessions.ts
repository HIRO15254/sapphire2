import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { SessionFilterValues } from "@/features/sessions/components/session-filters";
import {
	cancelTargets,
	invalidateTargets,
	restoreSnapshots,
	snapshotQuery,
} from "@/utils/optimistic-update";
import { trpc, trpcClient } from "@/utils/trpc";

export interface CashGameFormValues {
	ante?: number;
	anteType?: string;
	blind1?: number;
	blind2?: number;
	blind3?: number;
	breakMinutes?: number;
	buyIn: number;
	cashOut: number;
	currencyId?: string;
	endTime?: string;
	evCashOut?: number;
	memo?: string;
	ringGameId?: string;
	sessionDate: string;
	startTime?: string;
	storeId?: string;
	tableSize?: number;
	tagIds?: string[];
	type: "cash_game";
	variant: string;
}

export interface TournamentFormValues {
	addonCost?: number;
	beforeDeadline?: boolean;
	bountyPrizes?: number;
	breakMinutes?: number;
	currencyId?: string;
	endTime?: string;
	entryFee?: number;
	memo?: string;
	placement?: number;
	prizeMoney?: number;
	rebuyCost?: number;
	rebuyCount?: number;
	sessionDate: string;
	startTime?: string;
	storeId?: string;
	tagIds?: string[];
	totalEntries?: number;
	tournamentBuyIn: number;
	tournamentId?: string;
	type: "tournament";
}

export type SessionFormValues = CashGameFormValues | TournamentFormValues;

export interface SessionItem {
	beforeDeadline: boolean | null;
	bountyPrizes: number | null;
	breakMinutes: number | null;
	// Cash game detail fields (null for tournament sessions)
	cashBuyIn: number | null;
	cashOut: number | null;
	cashRingGameId: string | null;
	cashRuleName: string | null;
	createdAt: string | Date;
	currencyId: string | null;
	currencyName: string | null;
	currencyUnit: string | null;
	endedAt: string | Date | null;
	evCashOut: number | null;
	// Core session fields
	id: string;
	kind: string;
	memo: string | null;
	placement: number | null;
	prizeMoney: number | null;
	ringGameName: string | null;
	sessionDate: string | Date;
	source: string;
	startedAt: string | Date | null;
	status: string;
	storeId: string | null;
	storeName: string | null;
	// Tags
	tags: Array<{ id: string; name: string }>;
	totalEntries: number | null;
	// Tournament detail fields (null for cash game sessions)
	tournamentBuyIn: number | null;
	tournamentEntryFee: number | null;
	tournamentId: string | null;
	tournamentName: string | null;
	tournamentRuleName: string | null;
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

export function buildCreatePayload(values: SessionFormValues) {
	const sessionDate = Math.floor(new Date(values.sessionDate).getTime() / 1000);
	const common = {
		sessionDate,
		startedAt: timeToUnix(values.sessionDate, values.startTime),
		endedAt: timeToUnix(values.sessionDate, values.endTime),
		breakMinutes: values.breakMinutes,
		memo: values.memo,
		tagIds: values.tagIds,
		storeId: values.storeId,
		currencyId: values.currencyId,
	};
	if (values.type === "cash_game") {
		return {
			...common,
			type: "cash_game" as const,
			buyIn: values.buyIn,
			cashOut: values.cashOut,
			evCashOut: values.evCashOut,
			variant: values.variant,
			blind1: values.blind1,
			blind2: values.blind2,
			blind3: values.blind3,
			ante: values.ante,
			anteType: values.anteType as "none" | "all" | "bb" | undefined,
			tableSize: values.tableSize,
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
		rebuyCount: values.rebuyCount,
		rebuyCost: values.rebuyCost,
		addonCost: values.addonCost,
		bountyPrizes: values.bountyPrizes,
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
		storeId: values.storeId ?? null,
		currencyId: values.currencyId ?? null,
	};
}

export function buildUpdatePayload(values: SessionFormValues & { id: string }) {
	const common = {
		id: values.id,
		sessionDate: Math.floor(new Date(values.sessionDate).getTime() / 1000),
		startedAt: timeToUnix(values.sessionDate, values.startTime) ?? null,
		endedAt: timeToUnix(values.sessionDate, values.endTime) ?? null,
		breakMinutes: values.breakMinutes ?? null,
		memo: values.memo,
		tagIds: values.tagIds,
		storeId: values.storeId ?? null,
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
		rebuyCount: values.rebuyCount,
		rebuyCost: values.rebuyCost,
		addonCost: values.addonCost,
		bountyPrizes: values.bountyPrizes,
		tournamentId: values.tournamentId ?? null,
	};
}

export function buildOptimisticItem(
	newSession: SessionFormValues
): SessionItem {
	const item: SessionItem = {
		id: `temp-${Date.now()}`,
		kind: newSession.type,
		source: "manual",
		status: "completed",
		sessionDate: newSession.sessionDate,
		startedAt: null,
		endedAt: null,
		breakMinutes: newSession.breakMinutes ?? null,
		memo: newSession.memo ?? null,
		storeId: newSession.storeId ?? null,
		storeName: null,
		currencyId: newSession.currencyId ?? null,
		currencyName: null,
		currencyUnit: null,
		createdAt: new Date().toISOString(),
		// Cash detail (null for tournament)
		cashBuyIn: null,
		cashOut: null,
		evCashOut: null,
		cashRuleName: null,
		cashRingGameId: null,
		ringGameName: null,
		// Tournament detail (null for cash game)
		tournamentBuyIn: null,
		tournamentEntryFee: null,
		placement: null,
		totalEntries: null,
		beforeDeadline: null,
		prizeMoney: null,
		bountyPrizes: null,
		tournamentRuleName: null,
		tournamentId: null,
		tournamentName: null,
		tags: [],
	};
	if (newSession.type === "cash_game") {
		item.cashBuyIn = newSession.buyIn;
		item.cashOut = newSession.cashOut;
		item.evCashOut = newSession.evCashOut ?? null;
	} else {
		item.tournamentBuyIn = newSession.tournamentBuyIn;
		item.tournamentEntryFee = newSession.entryFee ?? null;
		item.beforeDeadline = newSession.beforeDeadline ?? null;
	}
	return item;
}

function toIsoString(value: string | Date | null): string | null {
	if (value === null) {
		return null;
	}
	return typeof value === "string" ? value : value.toISOString();
}

export function buildEditDefaults(session: SessionItem) {
	return {
		type: session.kind as "cash_game" | "tournament",
		sessionDate: formatDateForInput(toIsoString(session.sessionDate) ?? ""),
		buyIn: session.cashBuyIn ?? 0,
		cashOut: session.cashOut ?? 0,
		evCashOut: session.evCashOut ?? undefined,
		tournamentBuyIn: session.tournamentBuyIn ?? 0,
		entryFee: session.tournamentEntryFee ?? undefined,
		beforeDeadline: session.beforeDeadline ?? undefined,
		placement: session.placement ?? undefined,
		totalEntries: session.totalEntries ?? undefined,
		prizeMoney: session.prizeMoney ?? undefined,
		bountyPrizes: session.bountyPrizes ?? undefined,
		startTime: formatTimeFromDate(toIsoString(session.startedAt)),
		endTime: formatTimeFromDate(toIsoString(session.endedAt)),
		breakMinutes: session.breakMinutes ?? undefined,
		memo: session.memo ?? undefined,
		tagIds: session.tags.map((t) => t.id),
		storeId: session.storeId ?? undefined,
		ringGameId: session.cashRingGameId ?? undefined,
		tournamentId: session.tournamentId ?? undefined,
		currencyId: session.currencyId ?? undefined,
	};
}

export function filtersToListInput(filters: SessionFilterValues) {
	return {
		type: filters.type,
		storeId: filters.storeId,
		currencyId: filters.currencyId,
		dateFrom: filters.dateFrom
			? Math.floor(new Date(filters.dateFrom).getTime() / 1000)
			: undefined,
		dateTo: filters.dateTo
			? Math.floor(new Date(`${filters.dateTo}T23:59:59`).getTime() / 1000)
			: undefined,
	};
}

export function formatDateForInput(date: string): string {
	const d = new Date(date);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
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
	const sessionListKey = trpc.session.list.queryOptions(listInput).queryKey;

	const sessionsQuery = useQuery(trpc.session.list.queryOptions(listInput));
	const sessions = sessionsQuery.data?.items ?? [];

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
			trpcClient.session.create.mutate(
				buildCreatePayload(values) as unknown as Parameters<
					typeof trpcClient.session.create.mutate
				>[0]
			),
		onMutate: async (newSession) => {
			await cancelTargets(queryClient, [{ queryKey: sessionListKey }]);
			const previous = snapshotQuery(queryClient, sessionListKey);
			queryClient.setQueryData(sessionListKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					...old,
					items: [
						buildOptimisticItem(
							newSession
						) as unknown as (typeof old.items)[number],
						...old.items,
					],
				};
			});
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
			queryClient.setQueryData(sessionListKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					...old,
					items: old.items.map((s) =>
						s.id === updated.id
							? {
									...s,
									sessionDate: updated.sessionDate,
									memo: updated.memo ?? null,
								}
							: s
					),
				};
			});
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
			queryClient.setQueryData(sessionListKey, (old) => {
				if (!old) {
					return old;
				}
				return { ...old, items: old.items.filter((s) => s.id !== id) };
			});
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
		mutationFn: (sessionId: string) =>
			trpcClient.liveSession.reopen.mutate({ id: sessionId }),
		onSuccess: async () => {
			await invalidateTargets(queryClient, [{ queryKey: sessionListKey }]);
			await navigate({ to: "/active-session" });
		},
	});

	return {
		sessions,
		availableTags,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		create: (values: SessionFormValues) => createMutation.mutateAsync(values),
		update: (
			values: SessionFormValues & { id: string; isLiveLinked?: boolean }
		) => updateMutation.mutateAsync(values),
		delete: (id: string) => {
			deleteMutation.mutate(id);
		},
		reopen: (sessionId: string) => {
			reopenMutation.mutate(sessionId);
		},
		createTag: handleCreateTag,
	};
}
