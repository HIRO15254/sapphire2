import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TZ_EAST, TZ_WEST, withTz } from "@/__tests__/tz";
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
	sessionList: vi.fn(),
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
				infiniteQueryOptions: (
					input: unknown,
					opts: {
						getNextPageParam: (lastPage: { nextCursor?: string }) => unknown;
					}
				) => ({
					queryKey: buildKey("session", "list", input),
					queryFn: (...args: unknown[]) => trpcMocks.sessionList(...args),
					initialPageParam: undefined,
					getNextPageParam: opts.getNextPageParam,
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

// SA2-145: sessionDate must round-trip as a UTC calendar date regardless of the
// machine's local time zone. `withTz` (shared helper) drives a west-of-UTC and
// an east-of-UTC zone deterministically and restores the host zone afterwards.

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

/** Wrap rows in the single-page `useInfiniteQuery` cache envelope. */
function infiniteCache(items: SessionItem[], nextCursor?: string) {
	return { pageParams: [undefined], pages: [{ items, nextCursor }] };
}

/** Read the flattened first-page items out of an infinite-query cache entry. */
function firstPageItems(qc: QueryClient, key: ReturnType<typeof buildKey>) {
	return qc.getQueryData<{ pages: { items: SessionItem[] }[] }>(key)?.pages[0]
		?.items;
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
		beforeDeadline: null,
		bountyPrizes: null,
		breakMinutes: null,
		buyIn: 10_000,
		cashOut: 15_000,
		blindLevels: [],
		chipPurchases: [],
		chipPurchaseCost: 0,
		createdAt: "2026-04-01T00:00:00Z",
		// CTI discriminators — added in Phase 1 DB migration
		source: "manual",
		status: "completed",
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
		ringGameBlind2: null,
		ringGameId: null,
		ringGameName: null,
		startedAt: null,
		roomId: null,
		roomName: null,
		tags: [],
		totalEntries: null,
		tournamentBuyIn: null,
		tournamentId: null,
		tournamentName: null,
		cashAnte: null,
		cashAnteType: null,
		cashBlind1: null,
		cashBlind3: null,
		cashMaxBuyIn: null,
		cashMinBuyIn: null,
		cashTableSize: null,
		cashVariant: null,
		tournamentBountyAmount: null,
		tournamentStartingStack: null,
		tournamentTableSize: null,
		tournamentVariant: null,
		...overrides,
	};
}

describe("pure helpers", () => {
	describe("formatDateForInput", () => {
		it("formats ISO strings to YYYY-MM-DD", () => {
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

		// SA2-145: the API returns sessionDate as a UTC-midnight ISO string.
		// The edit form must echo back the SAME calendar day the user saved,
		// otherwise opening + saving an edit shifts the stored date one day
		// earlier for every user west of UTC.
		it("keeps the UTC calendar day at the exact UTC-midnight boundary west of UTC", () => {
			expect(
				withTz(TZ_WEST, () => formatDateForInput("2026-07-04T00:00:00Z"))
			).toBe("2026-07-04");
		});

		it("keeps the UTC calendar day at the exact UTC-midnight boundary east of UTC", () => {
			expect(
				withTz(TZ_EAST, () => formatDateForInput("2026-07-04T00:00:00Z"))
			).toBe("2026-07-04");
		});

		it("produces the same calendar day in west-of-UTC, east-of-UTC, and UTC zones", () => {
			const iso = "2026-01-01T00:00:00Z";
			const west = withTz(TZ_WEST, () => formatDateForInput(iso));
			const east = withTz(TZ_EAST, () => formatDateForInput(iso));
			const utc = withTz("UTC", () => formatDateForInput(iso));
			expect(west).toBe("2026-01-01");
			expect(east).toBe("2026-01-01");
			expect(utc).toBe("2026-01-01");
		});

		it("does not roll back across a year boundary west of UTC", () => {
			expect(
				withTz(TZ_WEST, () => formatDateForInput("2026-01-01T00:00:00Z"))
			).toBe("2026-01-01");
		});
	});

	// SA2-145: round-trip stability. Rendering a saved session into the edit
	// form and saving it unchanged must reproduce the original UTC-midnight
	// epoch. Before the fix, a west-of-UTC formatter shifted the day back one,
	// so each edit-save drifted the stored date earlier (cumulative).
	describe("sessionDate round-trip stability (UTC calendar date)", () => {
		it("buildCreatePayload stores UTC-midnight epoch seconds regardless of local zone", () => {
			const expected = Math.floor(Date.UTC(2026, 3, 1) / 1000);
			const west = withTz(
				TZ_WEST,
				() =>
					buildCreatePayload(cashValues({ sessionDate: "2026-04-01" }))
						.sessionDate
			);
			const east = withTz(
				TZ_EAST,
				() =>
					buildCreatePayload(cashValues({ sessionDate: "2026-04-01" }))
						.sessionDate
			);
			expect(west).toBe(expected);
			expect(east).toBe(expected);
		});

		it("format → save reproduces the original epoch and is stable on re-save (west of UTC)", () => {
			withTz(TZ_WEST, () => {
				const apiIso = "2026-07-04T00:00:00Z";
				const originalEpoch = Math.floor(Date.UTC(2026, 6, 4) / 1000);

				// First edit cycle: hydrate the form from the API row, save unchanged.
				const formValue = formatDateForInput(apiIso);
				expect(formValue).toBe("2026-07-04");
				const firstSave = buildUpdatePayload({
					...cashValues({ sessionDate: formValue }),
					id: "s1",
				}).sessionDate;
				expect(firstSave).toBe(originalEpoch);

				// Second edit cycle: re-render the just-saved epoch and save again.
				const roundTripIso = new Date(firstSave * 1000).toISOString();
				const secondForm = formatDateForInput(roundTripIso);
				const secondSave = buildUpdatePayload({
					...cashValues({ sessionDate: secondForm }),
					id: "s1",
				}).sessionDate;
				expect(secondSave).toBe(originalEpoch);
			});
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
					roomId: "s",
					currencyId: "c",
				})
			).toMatchObject({ type: "cash_game", roomId: "s", currencyId: "c" });
		});

		it("leaves the date range unset for the default (all) period", () => {
			const out = filtersToListInput({});
			expect(out.dateFrom).toBeUndefined();
			expect(out.dateTo).toBeUndefined();
		});

		it("passes a custom period's from/to bounds straight through", () => {
			const from = Math.floor(Date.UTC(2026, 3, 1, 0, 0, 0) / 1000);
			const to = Math.floor(Date.UTC(2026, 3, 30, 23, 59, 59) / 1000);
			const out = filtersToListInput({ period: "custom", from, to });
			expect(out.dateFrom).toBe(from);
			expect(out.dateTo).toBe(to);
		});

		it("resolves a relative period into a numeric, day-bounded range", () => {
			const out = filtersToListInput({ period: "30d" });
			expect(typeof out.dateFrom).toBe("number");
			expect(typeof out.dateTo).toBe("number");
			// End of today is strictly after the start of the 30-day window.
			expect((out.dateTo as number) > (out.dateFrom as number)).toBe(true);
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

		it("rolls the end time forward a day when it lands before the start (day-crossing, SA2-157)", () => {
			// 22:00 → 02:00 crossed midnight; endedAt must land 4h after startedAt,
			// not ~20h before it (which zeroed the session out of every stat).
			const out = buildCreatePayload(
				cashValues({ startTime: "22:00", endTime: "02:00" })
			);
			expect((out.endedAt as number) - (out.startedAt as number)).toBe(
				4 * 3600
			);
		});

		it("does not roll forward a normal same-day span (SA2-157)", () => {
			const out = buildCreatePayload(
				cashValues({ startTime: "09:00", endTime: "12:30" })
			);
			expect((out.endedAt as number) - (out.startedAt as number)).toBe(
				3.5 * 3600
			);
		});

		it("does not roll forward when start and end are equal (SA2-157)", () => {
			const out = buildCreatePayload(
				cashValues({ startTime: "20:00", endTime: "20:00" })
			);
			expect(out.endedAt).toBe(out.startedAt);
		});
	});

	describe("buildUpdatePayload", () => {
		it("nullifies optional link fields when undefined (cash_game)", () => {
			const out = buildUpdatePayload({
				...cashValues(),
				id: "s1",
			}) as Record<string, unknown>;
			expect(out.roomId).toBeNull();
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
				...cashValues({ roomId: "room-1", currencyId: "cur-1" }),
				id: "s1",
			});
			expect(out.roomId).toBe("room-1");
			expect(out.currencyId).toBe("cur-1");
		});

		it("forwards the edited rule name for cash and tournament", () => {
			const cash = buildUpdatePayload({
				...cashValues({ ruleName: "My 1/2 NLH" }),
				id: "s1",
			}) as Record<string, unknown>;
			expect(cash.ruleName).toBe("My 1/2 NLH");
			const tourney = buildUpdatePayload({
				...tournamentValues({ ruleName: "Weekly Deepstack" }),
				id: "s1",
			}) as Record<string, unknown>;
			expect(tourney.ruleName).toBe("Weekly Deepstack");
		});

		it("rolls the end time forward a day for a day-crossing update (SA2-157)", () => {
			const out = buildUpdatePayload({
				...cashValues({ startTime: "23:30", endTime: "01:00" }),
				id: "s1",
			}) as Record<string, unknown>;
			expect((out.endedAt as number) - (out.startedAt as number)).toBe(
				1.5 * 3600
			);
		});

		it("forwards cash min/max buy-in edits", () => {
			const out = buildUpdatePayload({
				...cashValues({ minBuyIn: 100, maxBuyIn: 500 }),
				id: "s1",
			}) as Record<string, unknown>;
			expect(out.minBuyIn).toBe(100);
			expect(out.maxBuyIn).toBe(500);
		});

		it("includes tournament snapshot overrides and blind levels", () => {
			const blindLevels = [
				{
					ante: null,
					blind1: 100,
					blind2: 200,
					blind3: null,
					games: null,
					isBreak: false,
					minutes: 15,
				},
			];
			const out = buildUpdatePayload({
				...tournamentValues({
					variant: "nlh",
					startingStack: 20_000,
					bountyAmount: 500,
					tableSize: 9,
					blindLevels,
				}),
				id: "s1",
			}) as Record<string, unknown>;
			expect(out.variant).toBe("nlh");
			expect(out.startingStack).toBe(20_000);
			expect(out.bountyAmount).toBe(500);
			expect(out.tableSize).toBe(9);
			expect(out.blindLevels).toEqual(blindLevels);
		});
	});

	describe("buildLiveLinkedUpdatePayload", () => {
		it("returns only id/memo/tagIds/roomId/currencyId with nulls for missing links", () => {
			const out = buildLiveLinkedUpdatePayload({
				...cashValues({ memo: "note", tagIds: ["t1"] }),
				id: "s1",
			});
			expect(out).toEqual({
				id: "s1",
				memo: "note",
				tagIds: ["t1"],
				roomId: null,
				currencyId: null,
			});
		});

		it("preserves provided roomId / currencyId", () => {
			const out = buildLiveLinkedUpdatePayload({
				...cashValues({ roomId: "st", currencyId: "cu" }),
				id: "s1",
			});
			expect(out.roomId).toBe("st");
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

		it("starts with an empty blind structure", () => {
			const out = buildOptimisticItem(cashValues());
			expect(out.blindLevels).toEqual([]);
		});

		it("copies the complete frozen cash rule snapshot for a manual mix", () => {
			const mixGames = [
				{
					ante: 5,
					anteType: "all" as const,
					blind1: 10,
					blind2: 20,
					blind3: 40,
					name: "Big Bet",
					variants: ["NL Hold'em"],
				},
			];
			const out = buildOptimisticItem(
				cashValues({
					ruleName: "Friday Rotation",
					variant: "Double Board Rotation",
					blind1: 10,
					blind2: 20,
					blind3: 40,
					ante: 5,
					anteType: "all",
					minBuyIn: 200,
					maxBuyIn: 1000,
					tableSize: 8,
					mixGames,
				})
			);
			expect(out.ringGameName).toBe("Friday Rotation");
			expect(out.cashVariant).toBe("Double Board Rotation");
			expect(out.cashBlind1).toBe(10);
			expect(out.ringGameBlind2).toBe(20);
			expect(out.cashBlind3).toBe(40);
			expect(out.cashAnte).toBe(5);
			expect(out.cashAnteType).toBe("all");
			expect(out.cashMinBuyIn).toBe(200);
			expect(out.cashMaxBuyIn).toBe(1000);
			expect(out.cashTableSize).toBe(8);
			expect(out.cashMixGames).toEqual(mixGames);
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

		it("pre-fills cash rule snapshot from the session row", () => {
			const out = buildEditDefaults(
				baseSessionItem({
					type: "cash_game",
					ringGameName: "1/2 NLH",
					cashVariant: "nlh",
					cashBlind1: 1,
					ringGameBlind2: 2,
					cashBlind3: 5,
					cashAnte: 2,
					cashAnteType: "all",
					cashMinBuyIn: 100,
					cashMaxBuyIn: 400,
					cashTableSize: 9,
				})
			);
			expect(out.ruleName).toBe("1/2 NLH");
			expect(out.variant).toBe("nlh");
			expect(out.blind1).toBe(1);
			expect(out.blind2).toBe(2);
			expect(out.blind3).toBe(5);
			expect(out.ante).toBe(2);
			expect(out.anteType).toBe("all");
			expect(out.minBuyIn).toBe(100);
			expect(out.maxBuyIn).toBe(400);
			expect(out.tableSize).toBe(9);
		});

		it("pre-fills tournament rule snapshot from the session row", () => {
			const out = buildEditDefaults(
				baseSessionItem({
					type: "tournament",
					tournamentName: "Main Event",
					tournamentVariant: "nlh",
					tournamentStartingStack: 20_000,
					tournamentBountyAmount: 500,
					tournamentTableSize: 9,
				})
			);
			expect(out.ruleName).toBe("Main Event");
			expect(out.variant).toBe("nlh");
			expect(out.startingStack).toBe(20_000);
			expect(out.bountyAmount).toBe(500);
			expect(out.tableSize).toBe(9);
		});

		it("pre-fills the tournament blind structure from the session row", () => {
			const out = buildEditDefaults(
				baseSessionItem({
					type: "tournament",
					tournamentName: "Main Event",
					blindLevels: [
						{
							isBreak: false,
							blind1: 100,
							blind2: 200,
							blind3: null,
							games: null,
							ante: 25,
							minutes: 20,
						},
						{
							isBreak: true,
							blind1: null,
							blind2: null,
							blind3: null,
							games: null,
							ante: null,
							minutes: 10,
						},
					],
				})
			);
			expect(out.blindLevels).toEqual([
				{
					isBreak: false,
					blind1: 100,
					blind2: 200,
					blind3: null,
					games: null,
					ante: 25,
					minutes: 20,
				},
				{
					isBreak: true,
					blind1: null,
					blind2: null,
					blind3: null,
					games: null,
					ante: null,
					minutes: 10,
				},
			]);
		});

		it("maps an empty blind structure to an empty array", () => {
			const out = buildEditDefaults(
				baseSessionItem({ type: "tournament", blindLevels: [] })
			);
			expect(out.blindLevels).toEqual([]);
		});

		it("tolerates a session whose blindLevels field is absent (stale response)", () => {
			// A getById response served by an older API build (or a cached
			// pre-migration entry) can omit blindLevels entirely; buildEditDefaults
			// must not throw when the field is undefined.
			const session = baseSessionItem({ type: "tournament" });
			session.blindLevels = undefined;
			expect(() => buildEditDefaults(session)).not.toThrow();
			expect(buildEditDefaults(session).blindLevels).toEqual([]);
		});

		it("leaves cash-only snapshot fields undefined on tournament rows", () => {
			const out = buildEditDefaults(
				baseSessionItem({
					type: "tournament",
					tournamentName: "Main Event",
				})
			);
			expect(out.blind1).toBeUndefined();
			expect(out.ante).toBeUndefined();
			expect(out.minBuyIn).toBeUndefined();
			expect(out.maxBuyIn).toBeUndefined();
		});

		it("leaves tournament-only snapshot fields undefined on cash rows", () => {
			const out = buildEditDefaults(
				baseSessionItem({
					type: "cash_game",
					ringGameName: "1/2 NLH",
				})
			);
			expect(out.startingStack).toBeUndefined();
			expect(out.bountyAmount).toBeUndefined();
		});
	});
});

describe("useSessions", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
		trpcMocks.sessionList.mockResolvedValue({
			items: [] as SessionItem[],
			nextCursor: undefined,
		});
		routerMocks.navigate.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("queries", () => {
		it("returns sessions from the list cache and tags from the tags cache", async () => {
			const qc = createClient();
			const listKey = listKeyForFilters(filtersToListInput({}));
			qc.setQueryData(listKey, infiniteCache([baseSessionItem({ id: "s1" })]));
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

		it("exposes a retryable initial-load error when the first sessions page fails", async () => {
			const qc = createClient();
			trpcMocks.sessionList.mockRejectedValue(new Error("Network unavailable"));
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});

			await waitFor(() => expect(result.current.isInitialLoadError).toBe(true));
			expect(result.current.sessions).toEqual([]);
			expect(result.current.onRetry).toBeTypeOf("function");
		});

		it("clears the initial-load error by retrying the sessions query once", async () => {
			const qc = createClient();
			trpcMocks.sessionList
				.mockRejectedValueOnce(new Error("Network unavailable"))
				.mockResolvedValueOnce({
					items: [baseSessionItem({ id: "retried" })],
					nextCursor: undefined,
				});
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});

			await waitFor(() => expect(result.current.isInitialLoadError).toBe(true));
			await act(async () => {
				await result.current.onRetry();
			});

			expect(trpcMocks.sessionList).toHaveBeenCalledTimes(2);
			await waitFor(() =>
				expect(result.current.isInitialLoadError).toBe(false)
			);
			expect(result.current.sessions.map((session) => session.id)).toEqual([
				"retried",
			]);
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
			qc.setQueryData(listKey, infiniteCache([baseSessionItem({ id: "s1" })]));
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
				const items = firstPageItems(qc, listKey);
				expect(items).toHaveLength(2);
				expect(items?.[0]?.id).toMatch(TEMP_ID_PATTERN);
				expect(items?.[1]?.id).toBe("s1");
			});
			resolve?.({ id: "real" });
		});

		it("passes the built payload through buildCreatePayload", async () => {
			const qc = createClient();
			qc.setQueryData(
				listKeyForFilters(filtersToListInput({})),
				infiniteCache([])
			);
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
			expect(trpcMocks.sessionCreate).toHaveBeenCalledTimes(1);
			expect(trpcMocks.sessionCreate).toHaveBeenCalledWith({
				ante: undefined,
				anteType: undefined,
				blind1: undefined,
				blind2: undefined,
				blind3: undefined,
				breakMinutes: undefined,
				buyIn: 10_000,
				cashOut: 15_000,
				currencyId: undefined,
				endedAt: undefined,
				evCashOut: undefined,
				maxBuyIn: undefined,
				memo: undefined,
				minBuyIn: undefined,
				mixGames: undefined,
				ringGameId: undefined,
				roomId: undefined,
				ruleName: undefined,
				sessionDate: 1_775_001_600,
				startedAt: undefined,
				tableSize: undefined,
				tagIds: undefined,
				type: "cash_game",
				variant: "NLH",
			});
		});
	});

	describe("update", () => {
		it("routes through buildUpdatePayload by default", async () => {
			const qc = createClient();
			qc.setQueryData(
				listKeyForFilters(filtersToListInput({})),
				infiniteCache([baseSessionItem({ id: "s1" })])
			);
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
			qc.setQueryData(
				listKeyForFilters(filtersToListInput({})),
				infiniteCache([baseSessionItem({ id: "s1" })])
			);
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
			qc.setQueryData(
				listKey,
				infiniteCache([
					baseSessionItem({
						id: "s1",
						sessionDate: "2026-01-01",
						memo: "old",
					}),
					baseSessionItem({ id: "s2", sessionDate: "2026-01-01", memo: null }),
				])
			);
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
				const items = firstPageItems(qc, listKey);
				expect(items?.[0]?.sessionDate).toBe("2026-05-05");
				expect(items?.[0]?.memo).toBe("new");
				// Untouched sibling preserved.
				expect(items?.[1]?.memo).toBeNull();
			});
			resolve?.({ id: "s1" });
		});
	});

	describe("delete", () => {
		it("optimistically removes the item from the list", async () => {
			const qc = createClient();
			const listKey = listKeyForFilters(filtersToListInput({}));
			qc.setQueryData(
				listKey,
				infiniteCache([
					baseSessionItem({ id: "s1" }),
					baseSessionItem({ id: "s2" }),
				])
			);
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
				expect(firstPageItems(qc, listKey)?.map((s) => s.id)).toEqual(["s2"]);
			});
			resolve?.({ id: "s1" });
		});
	});

	describe("reopen", () => {
		it("forwards the live session id and navigates to /active-session on success", async () => {
			const qc = createClient();
			qc.setQueryData(
				listKeyForFilters(filtersToListInput({})),
				infiniteCache([])
			);
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
			qc.setQueryData(
				listKeyForFilters(filtersToListInput({})),
				infiniteCache([])
			);
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

	describe("pagination", () => {
		it("flattens every loaded page into one sessions array and exposes hasNextPage", async () => {
			const qc = createClient();
			const listKey = listKeyForFilters(filtersToListInput({}));
			qc.setQueryData(listKey, {
				pageParams: [undefined, "s1"],
				pages: [
					{ items: [baseSessionItem({ id: "s1" })], nextCursor: "s1" },
					{ items: [baseSessionItem({ id: "s2" })], nextCursor: "s2" },
				],
			});
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => {
				expect(result.current.sessions.map((s) => s.id)).toEqual(["s1", "s2"]);
			});
			expect(result.current.hasNextPage).toBe(true);
			expect(result.current.isFetchingNextPage).toBe(false);
		});

		it("reports hasNextPage=false when the last page has no cursor", async () => {
			const qc = createClient();
			const listKey = listKeyForFilters(filtersToListInput({}));
			qc.setQueryData(listKey, infiniteCache([baseSessionItem({ id: "s1" })]));
			const { result } = renderHook(() => useSessions({}), {
				wrapper: makeWrapper(qc),
			});
			await waitFor(() => expect(result.current.sessions).toHaveLength(1));
			expect(result.current.hasNextPage).toBe(false);
			// Guard branch: calling fetchNextPage with no next page is a safe no-op.
			act(() => {
				result.current.fetchNextPage();
			});
			expect(result.current.sessions).toHaveLength(1);
		});
	});

	describe("pending flags", () => {
		it("flips isCreatePending / isUpdatePending during in-flight mutations", async () => {
			const qc = createClient();
			qc.setQueryData(
				listKeyForFilters(filtersToListInput({})),
				infiniteCache([baseSessionItem({ id: "s1" })])
			);
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
