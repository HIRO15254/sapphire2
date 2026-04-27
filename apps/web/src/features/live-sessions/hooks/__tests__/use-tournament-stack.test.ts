import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const navigateMock = vi.hoisted(() => vi.fn());
const trpcMocks = vi.hoisted(() => ({
	sessionEventCreate: vi.fn(),
	complete: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveCashGameSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveCashGameSession", "list", input),
				}),
			},
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
				}),
			},
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "list", input),
				}),
			},
		},
		sessionEvent: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("sessionEvent", "list", input),
				}),
			},
		},
		session: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "list", input),
				}),
			},
		},
		tournamentChipPurchase: {
			listByTournament: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey(
						"tournamentChipPurchase",
						"listByTournament",
						input
					),
				}),
			},
		},
	},
	trpcClient: {
		sessionEvent: {
			create: { mutate: trpcMocks.sessionEventCreate },
		},
		liveTournamentSession: {
			complete: { mutate: trpcMocks.complete },
		},
	},
}));

import { useTournamentStack } from "@/features/live-sessions/hooks/use-tournament-stack";

function createClient(): QueryClient {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
			mutations: { retry: false },
		},
	});
}

function makeWrapper(client: QueryClient) {
	return function Wrapper({ children }: { children: ReactNode }) {
		return createElement(QueryClientProvider, { client }, children);
	};
}

const sessionKey = ["liveTournamentSession", "getById", { id: "t1" }];
const eventsKey = ["sessionEvent", "list", { liveTournamentSessionId: "t1" }];
const activeListKey = [
	"liveTournamentSession",
	"list",
	{ status: "active", limit: 1 },
];
const pausedListKey = [
	"liveTournamentSession",
	"list",
	{ status: "paused", limit: 1 },
];
const chipPurchaseKey = (tournamentId: string) => [
	"tournamentChipPurchase",
	"listByTournament",
	{ tournamentId },
];

describe("useTournamentStack", () => {
	beforeEach(() => {
		navigateMock.mockReset();
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("chipPurchaseTypes (read-side)", () => {
		it("projects chipPurchase list from cache when session.tournamentId is present", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				tournamentId: "tourn-1",
				status: "active",
				summary: {},
			});
			qc.setQueryData(chipPurchaseKey("tourn-1"), [
				{ id: "cp1", name: "Rebuy", cost: 100, chips: 10_000 },
				{ id: "cp2", name: "Addon", cost: 200, chips: 20_000 },
			]);
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => {
				expect(result.current.chipPurchaseTypes).toEqual([
					{ name: "Rebuy", cost: 100, chips: 10_000 },
					{ name: "Addon", cost: 200, chips: 20_000 },
				]);
			});
		});

		it("returns [] when session is absent or has no tournamentId (enabled gate)", () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { status: "active", summary: {} });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.chipPurchaseTypes).toEqual([]);
		});
	});

	describe("recordStack (update_stack)", () => {
		it("forwards { stackAmount } and optimistically updates session summary", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				tournamentId: "tourn-1",
				status: "active",
				summary: { currentStack: 1000 },
			});
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.recordStack({ stackAmount: 5000 });
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					liveTournamentSessionId: "t1",
					eventType: "update_stack",
					payload: { stackAmount: 5000 },
				});
			});
			await waitFor(() => {
				const session = qc.getQueryData<{
					summary: { currentStack: number };
				}>(sessionKey);
				expect(session?.summary.currentStack).toBe(5000);
			});
		});
	});

	describe("purchaseChips", () => {
		it("forwards { name, cost, chips } payload", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				tournamentId: "tourn-1",
				status: "active",
				summary: {},
			});
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.purchaseChips({
					name: "Rebuy",
					cost: 100,
					chips: 10_000,
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					liveTournamentSessionId: "t1",
					eventType: "purchase_chips",
					payload: { name: "Rebuy", cost: 100, chips: 10_000 },
				});
			});
		});
	});

	describe("recordStack with tournament info", () => {
		it("forwards stackAmount + remainingPlayers/totalEntries/chipPurchaseCounts and computes averageStack optimistically", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				tournamentId: "tourn-1",
				status: "active",
				summary: {
					startingStack: 10_000,
					totalEntries: 100,
					remainingPlayers: 100,
				},
			});
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.recordStack({
					stackAmount: 25_000,
					remainingPlayers: 20,
					totalEntries: 100,
					chipPurchaseCounts: [],
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					liveTournamentSessionId: "t1",
					eventType: "update_stack",
					payload: {
						stackAmount: 25_000,
						remainingPlayers: 20,
						totalEntries: 100,
						chipPurchaseCounts: [],
					},
				});
			});
			await waitFor(() => {
				const session = qc.getQueryData<{
					summary: {
						remainingPlayers: number;
						totalEntries: number;
						averageStack: number;
					};
				}>(sessionKey);
				expect(session?.summary.remainingPlayers).toBe(20);
				expect(session?.summary.totalEntries).toBe(100);
				// (10_000 * 100) / 20 = 50_000
				expect(session?.summary.averageStack).toBe(50_000);
			});
		});

		it("accepts null remainingPlayers / totalEntries without throwing", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				tournamentId: "tourn-1",
				status: "active",
				summary: {},
			});
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.recordStack({
					stackAmount: 30_000,
					remainingPlayers: null,
					totalEntries: null,
					chipPurchaseCounts: [],
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalled();
			});
		});
	});

	describe("addMemo", () => {
		it("forwards { text } payload", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { status: "active", summary: {} });
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.addMemo("note");
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					liveTournamentSessionId: "t1",
					eventType: "memo",
					payload: { text: "note" },
				});
			});
		});
	});

	describe("pause / resume (changesStatus)", () => {
		it("pause transitions session.status to 'paused' and moves list item", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { status: "active", summary: {} });
			qc.setQueryData(eventsKey, []);
			qc.setQueryData(activeListKey, {
				items: [{ id: "t1", name: "T", status: "active" }],
			});
			qc.setQueryData(pausedListKey, { items: [] });
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.pause();
				await Promise.resolve();
			});
			await waitFor(() => {
				const session = qc.getQueryData<{ status: string }>(sessionKey);
				expect(session?.status).toBe("paused");
			});
			const active = qc.getQueryData<{ items: unknown[] }>(activeListKey);
			expect(active?.items).toEqual([]);
		});

		it("resume transitions session.status to 'active'", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { status: "paused", summary: {} });
			qc.setQueryData(eventsKey, []);
			qc.setQueryData(activeListKey, { items: [] });
			qc.setQueryData(pausedListKey, {
				items: [{ id: "t1", name: "T", status: "paused" }],
			});
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.resume();
				await Promise.resolve();
			});
			await waitFor(() => {
				const session = qc.getQueryData<{ status: string }>(sessionKey);
				expect(session?.status).toBe("active");
			});
		});
	});

	describe("complete", () => {
		it("beforeDeadline=false: forwards { placement, totalEntries, prizeMoney, bountyPrizes }", async () => {
			const qc = createClient();
			trpcMocks.complete.mockResolvedValue({ id: "t1" });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.complete({
					beforeDeadline: false,
					placement: 3,
					totalEntries: 100,
					prizeMoney: 50_000,
					bountyPrizes: 5000,
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.complete).toHaveBeenCalledWith({
					id: "t1",
					beforeDeadline: false,
					placement: 3,
					totalEntries: 100,
					prizeMoney: 50_000,
					bountyPrizes: 5000,
				});
			});
			await waitFor(() => {
				expect(navigateMock).toHaveBeenCalledWith({ to: "/sessions" });
			});
		});

		it("beforeDeadline=true: forwards only prizeMoney / bountyPrizes", async () => {
			const qc = createClient();
			trpcMocks.complete.mockResolvedValue({ id: "t1" });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.complete({
					beforeDeadline: true,
					prizeMoney: 1000,
					bountyPrizes: 100,
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.complete).toHaveBeenCalledWith({
					id: "t1",
					beforeDeadline: true,
					prizeMoney: 1000,
					bountyPrizes: 100,
				});
			});
		});

		it("flips isCompletePending while in flight", async () => {
			const qc = createClient();
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.complete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.complete({
					beforeDeadline: true,
					prizeMoney: 0,
					bountyPrizes: 0,
				});
			});
			await waitFor(() => expect(result.current.isCompletePending).toBe(true));
			resolve?.({ id: "t1" });
			await waitFor(() => expect(result.current.isCompletePending).toBe(false));
		});
	});

	describe("rollback on sessionEvent.create failure", () => {
		it("restores session.summary when update_stack fails", async () => {
			const qc = createClient();
			const initial = {
				tournamentId: "tourn-1",
				status: "active",
				summary: { currentStack: 1000 },
			};
			qc.setQueryData(sessionKey, initial);
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockRejectedValue(new Error("boom"));
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.recordStack({ stackAmount: 5000 });
				await Promise.resolve();
			});
			await waitFor(() =>
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalled()
			);
			await waitFor(() => {
				const session = qc.getQueryData<{
					summary: { currentStack: number };
				}>(sessionKey);
				expect(session?.summary.currentStack).toBe(1000);
			});
		});
	});
});
