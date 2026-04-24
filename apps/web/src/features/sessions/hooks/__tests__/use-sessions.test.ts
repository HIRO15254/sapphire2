import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
	SessionFormValues,
	SessionItem,
} from "@/features/sessions/hooks/use-sessions";

// ---------------------------------------------------------------------------
// Mocks for trpc + @tanstack/react-router's useNavigate.
// ---------------------------------------------------------------------------

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	sessionCreate: vi.fn(),
	sessionUpdate: vi.fn(),
	sessionDelete: vi.fn(),
	sessionTagCreate: vi.fn(),
	liveCashReopen: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => routerMocks.navigate,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "list", input),
					queryFn: () =>
						Promise.resolve({
							items: [] as SessionItem[],
							nextCursor: undefined,
						}),
				}),
			},
		},
		sessionTag: {
			list: {
				queryOptions: () => ({
					queryKey: buildKey("sessionTag", "list", undefined),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
		liveCashGameSession: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
				}),
			},
		},
	},
	trpcClient: {
		session: {
			create: { mutate: trpcMocks.sessionCreate },
			update: { mutate: trpcMocks.sessionUpdate },
			delete: { mutate: trpcMocks.sessionDelete },
		},
		sessionTag: {
			create: { mutate: trpcMocks.sessionTagCreate },
		},
		liveCashGameSession: {
			reopen: { mutate: trpcMocks.liveCashReopen },
		},
	},
}));

import {
	buildCreatePayload,
	buildEditDefaults,
	buildLiveLinkedUpdatePayload,
	buildOptimisticItem,
	buildUpdatePayload,
	filtersToListInput,
	formatDateForInput,
	formatTimeFromDate,
	useSessions,
} from "@/features/sessions/hooks/use-sessions";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HH_MM_PATTERN = /^\d{2}:\d{2}$/;
const TEMP_ID_PATTERN = /^temp-/;

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

function listKeyForFilters(filters: ReturnType<typeof filtersToListInput>) {
	return buildKey("session", "list", filters);
}

const TAG_LIST_KEY = buildKey("sessionTag", "list", undefined);

// Example SessionFormValues
function cashValues(
	overrides: Partial<SessionFormValues> = {}
): SessionFormValues {
	return {
		type: "cash_game",
		buyIn: 10_000,
		cashOut: 15_000,
		variant: "NLH",
		sessionDate: "2026-04-01",
		...overrides,
	} as SessionFormValues;
}

function tournamentValues(
	overrides: Partial<SessionFormValues> = {}
): SessionFormValues {
	return {
		type: "tournament",
		tournamentBuyIn: 5000,
		sessionDate: "2026-04-01",
		...overrides,
	} as SessionFormValues;
}

function baseSessionItem(overrides: Partial<SessionItem> = {}): SessionItem {
	return {
		id: "s1",
		type: "cash_game",
		sessionDate: "2026-04-01T00:00:00Z",
		addonCost: null,
		beforeDeadline: null,
		bountyPrizes: null,
		breakMinutes: null,
		buyIn: 10_000,
		cashOut: 15_000,
		createdAt: "2026-04-01T00:00:00Z",
		currencyId: null,
		currencyName: null,
		currencyUnit: null,
		endedAt: null,
		entryFee: null,
		evCashOut: null,
		evDiff: null,
		evProfitLoss: null,
		liveCashGameSessionId: null,
		liveTournamentSessionId: null,
		memo: null,
		placement: null,
		prizeMoney: null,
		profitLoss: 5000,
		rebuyCost: null,
		rebuyCount: null,
		ringGameBlind2: null,
		ringGameId: null,
		ringGameName: null,
		startedAt: null,
		storeId: null,
		storeName: null,
		tags: [],
		totalEntries: null,
		tournamentBuyIn: null,
		tournamentId: null,
		tournamentName: null,
		...overrides,
	};
}

describe("pure helpers", () => {
	describe("formatDateForInput", () => {
		it("formats ISO strings to YYYY-MM-DD (local time zone safe for midday)", () => {
			expect(formatDateForInput("2026-04-23T12:00:00Z")).toMatch(
				ISO_DATE_PATTERN
			);
		});

		it("zero-pads single-digit months and days", () => {
			const result = formatDateForInput("2026-01-03T12:00:00Z");
			const [, month, day] = result.split("-");
			expect(month).toHaveLength(2);
			expect(day).toHaveLength(2);
		});
	});

	describe("formatTimeFromDate", () => {
		it("returns undefined for null", () => {
			expect(formatTimeFromDate(null)).toBeUndefined();
		});

		it("returns HH:MM formatted for a valid date", () => {
			const out = formatTimeFromDate("2026-04-01T14:07:00");
			expect(out).toMatch(TIME_HH_MM_PATTERN);
		});
	});

	describe("filtersToListInput", () => {
		it("passes through basic filter fields", () => {
			expect(
				filtersToListInput({
					type: "cash_game",
					storeId: "s",
					currencyId: "c",
				})
			).toMatchObject({ type: "cash_game", storeId: "s", currencyId: "c" });
		});

		it("converts dateFrom to seconds since epoch (day start)", () => {
			const out = filtersToListInput({ dateFrom: "2026-04-01" });
			expect(typeof out.dateFrom).toBe("number");
			expect(out.dateTo).toBeUndefined();
		});

		it("appends T23:59:59 when converting dateTo", () => {
			const out = filtersToListInput({ dateTo: "2026-04-01" });
			const withStart = filtersToListInput({ dateFrom: "2026-04-01" });
			// dateTo (end of day) must be greater than dateFrom (start of day) for same date.
			expect((out.dateTo as number) > (withStart.dateFrom as number)).toBe(
				true
			);
		});
	});

	describe("buildCreatePayload", () => {
		it("produces the cash_game payload with variant / blinds / ante", () => {
			const out = buildCreatePayload(
				cashValues({
					blind1: 1,
					blind2: 2,
					ante: 0,
					anteType: "bb",
					tableSize: 9,
				})
			);
			expect(out).toMatchObject({
				type: "cash_game",
				buyIn: 10_000,
				cashOut: 15_000,
				variant: "NLH",
				blind1: 1,
				blind2: 2,
				ante: 0,
				anteType: "bb",
				tableSize: 9,
			});
		});

		it("produces the tournament payload with placement fields", () => {
			const out = buildCreatePayload(
				tournamentValues({ placement: 1, totalEntries: 100 })
			);
			expect(out).toMatchObject({
				type: "tournament",
				tournamentBuyIn: 5000,
				placement: 1,
				totalEntries: 100,
			});
		});

		it("coerces sessionDate to seconds since epoch and time fields to unix", () => {
			const out = buildCreatePayload(
				cashValues({ startTime: "09:00", endTime: "12:30" })
			);
			expect(typeof out.sessionDate).toBe("number");
			expect(typeof out.startedAt).toBe("number");
			expect(typeof out.endedAt).toBe("number");
			expect((out.endedAt as number) > (out.startedAt as number)).toBe(true);
		});

		it("leaves startedAt / endedAt undefined when time fields omitted", () => {
			const out = buildCreatePayload(cashValues());
			expect(out.startedAt).toBeUndefined();
			expect(out.endedAt).toBeUndefined();
		});
	});

	describe("buildUpdatePayload", () => {
		it("nullifies optional link fields when undefined (cash_game)", () => {
			const out = buildUpdatePayload({
				...cashValues(),
				id: "s1",
			}) as Record<string, unknown>;
			expect(out.storeId).toBeNull();
			expect(out.currencyId).toBeNull();
			expect(out.ringGameId).toBeNull();
			expect(out.evCashOut).toBeNull();
		});

		it("nullifies optional link fields when undefined (tournament)", () => {
			const out = buildUpdatePayload({
				...tournamentValues(),
				id: "s1",
			}) as Record<string, unknown>;
			expect(out.tournamentId).toBeNull();
			expect(out.placement).toBeNull();
			expect(out.totalEntries).toBeNull();
			expect(out.beforeDeadline).toBeNull();
		});

		it("retains provided link fields", () => {
			const out = buildUpdatePayload({
				...cashValues({ storeId: "store-1", currencyId: "cur-1" }),
				id: "s1",
			});
			expect(out.storeId).toBe("store-1");
			expect(out.currencyId).toBe("cur-1");
		});
	});

	describe("buildLiveLinkedUpdatePayload", () => {
		it("returns only id/memo/tagIds/storeId/currencyId with nulls for missing links", () => {
			const out = buildLiveLinkedUpdatePayload({
				...cashValues({ memo: "note", tagIds: ["t1"] }),
				id: "s1",
			});
			expect(out).toEqual({
				id: "s1",
				memo: "note",
				tagIds: ["t1"],
				storeId: null,
				currencyId: null,
			});
		});

		it("preserves provided storeId / currencyId", () => {
			const out = buildLiveLinkedUpdatePayload({
				...cashValues({ storeId: "st", currencyId: "cu" }),
				id: "s1",
			});
			expect(out.storeId).toBe("st");
			expect(out.currencyId).toBe("cu");
		});
	});

	describe("buildOptimisticItem", () => {
		it("computes profitLoss for cash_game = cashOut - buyIn", () => {
			const out = buildOptimisticItem(cashValues({ buyIn: 100, cashOut: 150 }));
			expect(out.type).toBe("cash_game");
			expect(out.profitLoss).toBe(50);
			expect(out.evProfitLoss).toBeNull();
			expect(out.evDiff).toBeNull();
		});

		it("computes evProfitLoss and evDiff when evCashOut provided", () => {
			const out = buildOptimisticItem(
				cashValues({ buyIn: 100, cashOut: 150, evCashOut: 200 })
			);
			expect(out.evProfitLoss).toBe(100);
			expect(out.evDiff).toBe(50);
		});

		it("tournament branch leaves cash-specific fields null", () => {
			const out = buildOptimisticItem(
				tournamentValues({ tournamentBuyIn: 500 })
			);
			expect(out.type).toBe("tournament");
			expect(out.tournamentBuyIn).toBe(500);
			expect(out.buyIn).toBeNull();
			expect(out.cashOut).toBeNull();
			expect(out.profitLoss).toBe(0);
		});

		it("id is a synthetic temp-* marker", () => {
			const out = buildOptimisticItem(cashValues());
			expect(out.id).toMatch(TEMP_ID_PATTERN);
		});
	});

	describe("buildEditDefaults", () => {
		it("coerces null numeric fields to 0 (buyIn/cashOut) for cash game", () => {
			const out = buildEditDefaults(
				baseSessionItem({ buyIn: null, cashOut: null })
			);
			expect(out.buyIn).toBe(0);
			expect(out.cashOut).toBe(0);
		});

		it("preserves tags as tagIds array", () => {
			const out = buildEditDefaults(
				baseSessionItem({
					tags: [
						{ id: "t1", name: "a" },
						{ id: "t2", name: "b" },
					],
				})
			);
			expect(out.tagIds).toEqual(["t1", "t2"]);
		});
	});
});

describe("useSessions", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
		routerMocks.navigate.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("queries", () => {
		it("returns sessions from the list cache and tags from the tags cache", async () => {
			const qc = createClient();
			const listKey = listKeyForFilters(filtersToListInput({}));
			qc.setQueryData(listKey, {
				items: [baseSessionItem({ id: "s1" })],
				nextCursor: undefined,
			});
			qc.setQueryData(TAG_LIST_KEY, [{ id: "tag-1", name: "series" }]);

			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => {
				expect(result.current.sessions).toHaveLength(1);
				expect(result.current.availableTags).toEqual([
					{ id: "tag-1", name: "series" },
				]);
			});
		});

		it("returns empty arrays when nothing is cached", () => {
			const qc = createClient();
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			expect(result.current.sessions).toEqual([]);
			expect(result.current.availableTags).toEqual([]);
		});
	});

	describe("createTag", () => {
		it("returns {id, name} shape from the mutation result", async () => {
			const qc = createClient();
			trpcMocks.sessionTagCreate.mockResolvedValue({
				id: "tag-1",
				name: "Series",
				userId: "u1",
			});
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			let value: { id: string; name: string } | undefined;
			await act(async () => {
				value = await result.current.createTag("Series");
			});
			expect(trpcMocks.sessionTagCreate).toHaveBeenCalledWith({
				name: "Series",
			});
			expect(value).toEqual({ id: "tag-1", name: "Series" });
		});
	});

	describe("create (optimistic)", () => {
		it("optimistically prepends an optimistic item to the list during mutation", async () => {
			const qc = createClient();
			const listKey = listKeyForFilters(filtersToListInput({}));
			qc.setQueryData(listKey, {
				items: [baseSessionItem({ id: "s1" })],
				nextCursor: undefined,
			});
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.sessionCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.create(cashValues({ buyIn: 1000, cashOut: 2000 }));
			});
			await waitFor(() => {
				const data = qc.getQueryData<{ items: SessionItem[] }>(listKey);
				expect(data?.items).toHaveLength(2);
				expect(data?.items[0]?.id).toMatch(TEMP_ID_PATTERN);
				expect(data?.items[1]?.id).toBe("s1");
			});
			resolve?.({ id: "real" });
		});

		it("passes the built payload through buildCreatePayload", async () => {
			const qc = createClient();
			qc.setQueryData(listKeyForFilters(filtersToListInput({})), {
				items: [] as SessionItem[],
				nextCursor: undefined,
			});
			trpcMocks.sessionCreate.mockResolvedValue({ id: "real" });
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create(cashValues());
			});
			const arg = trpcMocks.sessionCreate.mock.calls[0]?.[0] as Record<
				string,
				unknown
			>;
			expect(arg.type).toBe("cash_game");
			expect(arg.buyIn).toBe(10_000);
			expect(typeof arg.sessionDate).toBe("number");
		});

		it("no-ops cache mutation when list is undefined", async () => {
			const qc = createClient();
			// No seed → old === undefined in onMutate returns old unchanged.
			trpcMocks.sessionCreate.mockResolvedValue({ id: "real" });
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.create(cashValues());
			});
			expect(trpcMocks.sessionCreate).toHaveBeenCalled();
		});
	});

	describe("update", () => {
		it("routes through buildUpdatePayload by default", async () => {
			const qc = createClient();
			qc.setQueryData(listKeyForFilters(filtersToListInput({})), {
				items: [baseSessionItem({ id: "s1" })],
				nextCursor: undefined,
			});
			trpcMocks.sessionUpdate.mockResolvedValue({ id: "s1" });
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.update({ ...cashValues(), id: "s1" });
			});
			const arg = trpcMocks.sessionUpdate.mock.calls[0]?.[0] as Record<
				string,
				unknown
			>;
			expect(arg.id).toBe("s1");
			expect(arg.variant).toBe("NLH");
		});

		it("routes through buildLiveLinkedUpdatePayload when isLiveLinked=true", async () => {
			const qc = createClient();
			qc.setQueryData(listKeyForFilters(filtersToListInput({})), {
				items: [baseSessionItem({ id: "s1" })],
				nextCursor: undefined,
			});
			trpcMocks.sessionUpdate.mockResolvedValue({ id: "s1" });
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				await result.current.update({
					...cashValues({ memo: "live memo" }),
					id: "s1",
					isLiveLinked: true,
				});
			});
			const arg = trpcMocks.sessionUpdate.mock.calls[0]?.[0] as Record<
				string,
				unknown
			>;
			expect(arg.memo).toBe("live memo");
			// buildLiveLinkedUpdatePayload omits buy-in/cash-out fields.
			expect("buyIn" in arg).toBe(false);
			expect("cashOut" in arg).toBe(false);
		});

		it("optimistically patches sessionDate + memo on matching item", async () => {
			const qc = createClient();
			const listKey = listKeyForFilters(filtersToListInput({}));
			qc.setQueryData(listKey, {
				items: [
					baseSessionItem({
						id: "s1",
						sessionDate: "2026-01-01",
						memo: "old",
					}),
					baseSessionItem({ id: "s2", sessionDate: "2026-01-01", memo: null }),
				],
				nextCursor: undefined,
			});
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.sessionUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.update({
					...cashValues({ sessionDate: "2026-05-05", memo: "new" }),
					id: "s1",
				});
			});
			await waitFor(() => {
				const data = qc.getQueryData<{ items: SessionItem[] }>(listKey);
				expect(data?.items[0]?.sessionDate).toBe("2026-05-05");
				expect(data?.items[0]?.memo).toBe("new");
				// Untouched sibling preserved.
				expect(data?.items[1]?.memo).toBeNull();
			});
			resolve?.({ id: "s1" });
		});
	});

	describe("delete", () => {
		it("optimistically removes the item from the list", async () => {
			const qc = createClient();
			const listKey = listKeyForFilters(filtersToListInput({}));
			qc.setQueryData(listKey, {
				items: [baseSessionItem({ id: "s1" }), baseSessionItem({ id: "s2" })],
				nextCursor: undefined,
			});
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.sessionDelete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.delete("s1");
			});
			await waitFor(() => {
				const data = qc.getQueryData<{ items: SessionItem[] }>(listKey);
				expect(data?.items.map((s) => s.id)).toEqual(["s2"]);
			});
			resolve?.({ id: "s1" });
		});
	});

	describe("reopen", () => {
		it("forwards the live session id and navigates to /active-session on success", async () => {
			const qc = createClient();
			qc.setQueryData(listKeyForFilters(filtersToListInput({})), {
				items: [] as SessionItem[],
				nextCursor: undefined,
			});
			trpcMocks.liveCashReopen.mockResolvedValue(undefined);

			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				result.current.reopen("live-1");
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.liveCashReopen).toHaveBeenCalledWith({ id: "live-1" });
				expect(routerMocks.navigate).toHaveBeenCalledWith({
					to: "/active-session",
				});
			});
		});

		it("does not navigate when reopen mutation fails", async () => {
			const qc = createClient();
			qc.setQueryData(listKeyForFilters(filtersToListInput({})), {
				items: [] as SessionItem[],
				nextCursor: undefined,
			});
			trpcMocks.liveCashReopen.mockRejectedValue(new Error("500"));
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			await act(async () => {
				result.current.reopen("live-1");
				await Promise.resolve();
			});
			// Wait a tick for mutation to settle.
			await waitFor(() =>
				expect(trpcMocks.liveCashReopen).toHaveBeenCalledTimes(1)
			);
			expect(routerMocks.navigate).not.toHaveBeenCalled();
		});
	});

	describe("pending flags", () => {
		it("flips isCreatePending / isUpdatePending during in-flight mutations", async () => {
			const qc = createClient();
			qc.setQueryData(listKeyForFilters(filtersToListInput({})), {
				items: [baseSessionItem({ id: "s1" })],
				nextCursor: undefined,
			});
			let resolveC: ((v: unknown) => void) | undefined;
			let resolveU: ((v: unknown) => void) | undefined;
			trpcMocks.sessionCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolveC = r;
					})
			);
			trpcMocks.sessionUpdate.mockImplementation(
				() =>
					new Promise((r) => {
						resolveU = r;
					})
			);

			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			act(() => {
				result.current.create(cashValues());
			});
			await waitFor(() => expect(result.current.isCreatePending).toBe(true));
			resolveC?.({ id: "c" });
			await waitFor(() => expect(result.current.isCreatePending).toBe(false));

			act(() => {
				result.current.update({ ...cashValues(), id: "s1" });
			});
			await waitFor(() => expect(result.current.isUpdatePending).toBe(true));
			resolveU?.({ id: "s1" });
			await waitFor(() => expect(result.current.isUpdatePending).toBe(false));
		});
	});
});
