import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { SessionFilterValues } from "@/sessions/components/session-filters";
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
	addonCost: number | null;
	bountyPrizes: number | null;
	breakMinutes: number | null;
	buyIn: number | null;
	cashOut: number | null;
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
	rebuyCost: number | null;
	rebuyCount: number | null;
	ringGameBlind2: number | null;
	ringGameId: string | null;
	ringGameName: string | null;
	sessionDate: string;
	startedAt: string | null;
	storeId: string | null;
	storeName: string | null;
	tags: Array<{ id: string; name: string }>;
	totalEntries: number | null;
	tournamentBuyIn: number | null;
	tournamentId: string | null;
	tournamentName: string | null;
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
		placement: values.placement,
		totalEntries: values.totalEntries,
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
		type: newSession.type,
		sessionDate: newSession.sessionDate,
		buyIn: null,
		cashOut: null,
		evCashOut: null,
		evProfitLoss: null,
		evDiff: null,
		tournamentBuyIn: null,
		entryFee: null,
		placement: null,
		totalEntries: null,
		prizeMoney: null,
		rebuyCount: null,
		rebuyCost: null,
		addonCost: null,
		bountyPrizes: null,
		breakMinutes: newSession.breakMinutes ?? null,
		profitLoss: 0,
		startedAt: null,
		endedAt: null,
		memo: newSession.memo ?? null,
		storeId: newSession.storeId ?? null,
		storeName: null,
		ringGameId: null,
		ringGameBlind2: null,
		ringGameName: null,
		tournamentId: null,
		tournamentName: null,
		currencyId: newSession.currencyId ?? null,
		currencyName: null,
		currencyUnit: null,
		createdAt: new Date().toISOString(),
		liveCashGameSessionId: null,
		liveTournamentSessionId: null,
		tags: [],
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
	}
	return item;
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
		placement: session.placement ?? undefined,
		totalEntries: session.totalEntries ?? undefined,
		prizeMoney: session.prizeMoney ?? undefined,
		rebuyCount: session.rebuyCount ?? undefined,
		rebuyCost: session.rebuyCost ?? undefined,
		addonCost: session.addonCost ?? undefined,
		bountyPrizes: session.bountyPrizes ?? undefined,
		startTime: formatTimeFromDate(session.startedAt),
		endTime: formatTimeFromDate(session.endedAt),
		breakMinutes: session.breakMinutes ?? undefined,
		memo: session.memo ?? undefined,
		tagIds: session.tags.map((t) => t.id),
		storeId: session.storeId ?? undefined,
		ringGameId: session.ringGameId ?? undefined,
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
			queryClient.invalidateQueries({
				queryKey: trpc.sessionTag.list.queryOptions().queryKey,
			});
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
			await queryClient.cancelQueries({ queryKey: sessionListKey });
			const previous = queryClient.getQueryData(sessionListKey);
			queryClient.setQueryData(sessionListKey, (old) => {
				if (!old) {
					return old;
				}
				return {
					...old,
					items: [buildOptimisticItem(newSession), ...old.items],
				};
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(sessionListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: sessionListKey });
		},
	});

	const updateMutation = useMutation({
		mutationFn: (values: SessionFormValues & { id: string }) =>
			trpcClient.session.update.mutate(buildUpdatePayload(values)),
		onMutate: async (updated) => {
			await queryClient.cancelQueries({ queryKey: sessionListKey });
			const previous = queryClient.getQueryData(sessionListKey);
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
			if (context?.previous) {
				queryClient.setQueryData(sessionListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: sessionListKey });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (id: string) => trpcClient.session.delete.mutate({ id }),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: sessionListKey });
			const previous = queryClient.getQueryData(sessionListKey);
			queryClient.setQueryData(sessionListKey, (old) => {
				if (!old) {
					return old;
				}
				return { ...old, items: old.items.filter((s) => s.id !== id) };
			});
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(sessionListKey, context.previous);
			}
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: sessionListKey });
		},
	});

	const reopenMutation = useMutation({
		mutationFn: (liveCashGameSessionId: string) =>
			trpcClient.liveCashGameSession.reopen.mutate({
				id: liveCashGameSessionId,
			}),
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: sessionListKey }),
				queryClient.invalidateQueries({
					queryKey: trpc.liveCashGameSession.list.queryOptions({}).queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: trpc.liveCashGameSession.list.queryOptions({
						status: "active",
						limit: 1,
					}).queryKey,
				}),
				queryClient.invalidateQueries({
					queryKey: trpc.liveCashGameSession.list.queryOptions({
						status: "paused",
						limit: 1,
					}).queryKey,
				}),
			]);
			await navigate({ to: "/active-session" });
		},
	});

	return {
		sessions,
		availableTags,
		isCreatePending: createMutation.isPending,
		isUpdatePending: updateMutation.isPending,
		create: (values: SessionFormValues) => createMutation.mutateAsync(values),
		update: (values: SessionFormValues & { id: string }) =>
			updateMutation.mutateAsync(values),
		delete: (id: string) => {
			deleteMutation.mutate(id);
		},
		reopen: (liveCashGameSessionId: string) => {
			reopenMutation.mutate(liveCashGameSessionId);
		},
		createTag: handleCreateTag,
	};
}
