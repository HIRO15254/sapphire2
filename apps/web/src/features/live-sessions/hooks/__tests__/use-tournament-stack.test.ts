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
	liveSessionComplete: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => navigateMock,
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		liveSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveSession", "getById", input),
					queryFn: () => Promise.resolve(null),
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
	},
	trpcClient: {
		sessionEvent: {
			create: { mutate: trpcMocks.sessionEventCreate },
		},
		liveSession: {
			complete: { mutate: trpcMocks.liveSessionComplete },
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

const sessionKey = ["liveSession", "getById", { id: "t1" }];
const eventsKey = ["sessionEvent", "list", { sessionId: "t1" }];
const sessionListKey = ["session", "list", {}];

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
		it("projects chipPurchaseOptions from liveSession.getById cache", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				id: "t1",
				status: "active",
				summary: {},
				chipPurchaseOptions: [
					{ id: "cp1", name: "Rebuy", cost: 100, chips: 10_000, sortOrder: 0 },
					{ id: "cp2", name: "Addon", cost: 200, chips: 20_000, sortOrder: 1 },
				],
				currentPlayers: [],
			});
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => {
				expect(result.current.chipPurchaseTypes).toHaveLength(2);
			});
			expect(result.current.chipPurchaseTypes[0]).toMatchObject({
				id: "cp1",
				name: "Rebuy",
				cost: 100,
				chips: 10_000,
			});
		});

		it("returns [] when session has no chipPurchaseOptions", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.chipPurchaseTypes).toEqual([]);
		});
	});

	describe("recordStack (update_stack)", () => {
		it("forwards { stackAmount } to sessionEvent.create", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				status: "active",
				summary: { currentStack: 1000 },
				chipPurchaseOptions: [],
				currentPlayers: [],
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
					sessionId: "t1",
					eventType: "update_stack",
					payload: { stackAmount: 5000 },
				});
			});
		});
	});

	describe("purchaseChips", () => {
		it("accepts { chipPurchaseOptionId } directly", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				status: "active",
				summary: {},
				chipPurchaseOptions: [],
				currentPlayers: [],
			});
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useTournamentStack({ sessionId: "t1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.purchaseChips({ chipPurchaseOptionId: "cp1" });
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					sessionId: "t1",
					eventType: "purchase_chips",
					payload: { chipPurchaseOptionId: "cp1" },
				});
			});
		});
	});

	describe("addMemo", () => {
		it("forwards { text } payload", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				status: "active",
				summary: {},
				chipPurchaseOptions: [],
				currentPlayers: [],
			});
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
					sessionId: "t1",
					eventType: "memo",
					payload: { text: "note" },
				});
			});
		});
	});

	describe("pause / resume", () => {
		it("pause sends session_pause event", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				status: "active",
				summary: {},
				chipPurchaseOptions: [],
				currentPlayers: [],
			});
			qc.setQueryData(eventsKey, []);
			qc.setQueryData(sessionListKey, { items: [] });
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
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					sessionId: "t1",
					eventType: "session_pause",
					payload: {},
				});
			});
		});

		it("resume sends session_resume event", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				status: "paused",
				summary: {},
				chipPurchaseOptions: [],
				currentPlayers: [],
			});
			qc.setQueryData(eventsKey, []);
			qc.setQueryData(sessionListKey, { items: [] });
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
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					sessionId: "t1",
					eventType: "session_resume",
					payload: {},
				});
			});
		});
	});

	describe("complete", () => {
		it("beforeDeadline=false: calls liveSession.complete with kind=tournament and result fields", async () => {
			const qc = createClient();
			qc.setQueryData(sessionListKey, { items: [] });
			trpcMocks.liveSessionComplete.mockResolvedValue({ id: "t1" });
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
				expect(trpcMocks.liveSessionComplete).toHaveBeenCalledWith(
					expect.objectContaining({
						id: "t1",
						kind: "tournament",
						beforeDeadline: false,
						placement: 3,
						totalEntries: 100,
						prizeMoney: 50_000,
						bountyPrizes: 5000,
					})
				);
			});
			await waitFor(() => {
				expect(navigateMock).toHaveBeenCalledWith({ to: "/sessions" });
			});
		});

		it("beforeDeadline=true: calls liveSession.complete with kind=tournament and minimal fields", async () => {
			const qc = createClient();
			qc.setQueryData(sessionListKey, { items: [] });
			trpcMocks.liveSessionComplete.mockResolvedValue({ id: "t1" });
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
				expect(trpcMocks.liveSessionComplete).toHaveBeenCalledWith(
					expect.objectContaining({
						id: "t1",
						kind: "tournament",
						beforeDeadline: true,
						prizeMoney: 1000,
						bountyPrizes: 100,
					})
				);
			});
		});

		it("flips isCompletePending while in flight", async () => {
			const qc = createClient();
			qc.setQueryData(sessionListKey, { items: [] });
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.liveSessionComplete.mockImplementation(
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

	describe("isStackPending", () => {
		it("flips isStackPending while recordStack is in flight", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				status: "active",
				summary: {},
				chipPurchaseOptions: [],
				currentPlayers: [],
			});
			qc.setQueryData(eventsKey, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.sessionEventCreate.mockImplementation(
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
				result.current.recordStack({ stackAmount: 5000 });
			});
			await waitFor(() => expect(result.current.isStackPending).toBe(true));
			resolve?.({ id: "e1" });
			await waitFor(() => expect(result.current.isStackPending).toBe(false));
		});
	});
});
