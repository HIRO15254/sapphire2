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

import { useCashGameStack } from "@/features/live-sessions/hooks/use-cash-game-stack";

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

// cash_game kind — liveSession.getById is not queried (only for tournament)
// events list is keyed by sessionId
const sessionKey = ["liveSession", "getById", { id: "s1" }];
const eventsKey = ["sessionEvent", "list", { sessionId: "s1" }];
const sessionListKey = ["session", "list", {}];

describe("useCashGameStack", () => {
	beforeEach(() => {
		navigateMock.mockReset();
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("recordStack (update_stack)", () => {
		it("forwards payload { stackAmount } to sessionEvent.create and optimistically updates session.summary.currentStack", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				status: "active",
				summary: { currentStack: 1000 },
			});
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });

			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.recordStack({ stackAmount: 2500 });
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					sessionId: "s1",
					eventType: "update_stack",
					payload: { stackAmount: 2500 },
				});
			});
			await waitFor(() => {
				const session = qc.getQueryData<{
					summary: { currentStack: number };
				}>(sessionKey);
				expect(session?.summary.currentStack).toBe(2500);
			});
		});

		it("flips isStackPending during in-flight update_stack", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { status: "active", summary: {} });
			qc.setQueryData(eventsKey, []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.sessionEventCreate.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.recordStack({ stackAmount: 100 });
			});
			await waitFor(() => expect(result.current.isStackPending).toBe(true));
			resolve?.({ id: "e1" });
			await waitFor(() => expect(result.current.isStackPending).toBe(false));
		});
	});

	describe("chip add/remove (chips_add_remove)", () => {
		it("addChip: posts a positive { amount }", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { status: "active", summary: {} });
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.addChip(500);
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					sessionId: "s1",
					eventType: "chips_add_remove",
					payload: { amount: 500 },
				});
			});
		});

		it("removeChip: posts a negative { amount }", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { status: "active", summary: {} });
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.removeChip(200);
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					sessionId: "s1",
					eventType: "chips_add_remove",
					payload: { amount: -200 },
				});
			});
		});
	});

	describe("addAllIn (all_in)", () => {
		it("forwards full payload and optimistically accumulates evDiff", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, {
				status: "active",
				summary: { evDiff: 0 },
			});
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.addAllIn({
					potSize: 1000,
					trials: 100,
					equity: 60,
					wins: 50,
				});
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					sessionId: "s1",
					eventType: "all_in",
					payload: { potSize: 1000, trials: 100, equity: 60, wins: 50 },
				});
			});
			await waitFor(() => {
				const session = qc.getQueryData<{
					summary: { evDiff: number };
				}>(sessionKey);
				// 0 + 1000 * 0.6 - (1000/100) * 50 = 600 - 500 = 100
				expect(session?.summary.evDiff).toBe(100);
			});
		});
	});

	describe("addMemo (memo)", () => {
		it("forwards { text } payload", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { status: "active", summary: {} });
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.addMemo("bad beat");
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
					sessionId: "s1",
					eventType: "memo",
					payload: { text: "bad beat" },
				});
			});
		});
	});

	describe("pause (changesStatus)", () => {
		it("transitions session.status to 'paused' and sends session_pause event", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { status: "active", summary: {} });
			qc.setQueryData(eventsKey, []);
			qc.setQueryData(sessionListKey, {
				items: [{ id: "s1", name: "Cash", status: "active" }],
			});
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.pause();
				await Promise.resolve();
			});
			await waitFor(() => {
				const session = qc.getQueryData<{
					status: string;
				}>(sessionKey);
				expect(session?.status).toBe("paused");
			});
			expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
				sessionId: "s1",
				eventType: "session_pause",
				payload: {},
			});
		});
	});

	describe("resume (changesStatus)", () => {
		it("transitions session.status to 'active' and sends session_resume event", async () => {
			const qc = createClient();
			qc.setQueryData(sessionKey, { status: "paused", summary: {} });
			qc.setQueryData(eventsKey, []);
			qc.setQueryData(sessionListKey, { items: [] });
			trpcMocks.sessionEventCreate.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.resume();
				await Promise.resolve();
			});
			await waitFor(() => {
				const session = qc.getQueryData<{
					status: string;
				}>(sessionKey);
				expect(session?.status).toBe("active");
			});
			expect(trpcMocks.sessionEventCreate).toHaveBeenCalledWith({
				sessionId: "s1",
				eventType: "session_resume",
				payload: {},
			});
		});
	});

	describe("complete", () => {
		it("calls liveSession.complete with kind=cash_game and navigates to /sessions on success", async () => {
			const qc = createClient();
			qc.setQueryData(sessionListKey, { items: [] });
			trpcMocks.liveSessionComplete.mockResolvedValue({ id: "s1" });
			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.complete({ finalStack: 9000 });
				await Promise.resolve();
			});
			await waitFor(() => {
				expect(trpcMocks.liveSessionComplete).toHaveBeenCalledWith({
					id: "s1",
					kind: "cash_game",
					finalStack: 9000,
				});
			});
			await waitFor(() => {
				expect(navigateMock).toHaveBeenCalledWith({ to: "/sessions" });
			});
		});

		it("flips isCompletePending during in-flight complete", async () => {
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
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.complete({ finalStack: 0 });
			});
			await waitFor(() => expect(result.current.isCompletePending).toBe(true));
			resolve?.({ id: "s1" });
			await waitFor(() => expect(result.current.isCompletePending).toBe(false));
		});

		it("does not navigate on complete failure", async () => {
			const qc = createClient();
			trpcMocks.liveSessionComplete.mockRejectedValue(new Error("x"));
			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.complete({ finalStack: 0 });
				await Promise.resolve();
			});
			await waitFor(() => expect(trpcMocks.liveSessionComplete).toHaveBeenCalled());
			await Promise.resolve();
			expect(navigateMock).not.toHaveBeenCalled();
		});
	});

	describe("rollback on sessionEvent.create failure", () => {
		it("restores session.summary when update_stack fails", async () => {
			const qc = createClient();
			const initial = { status: "active", summary: { currentStack: 1000 } };
			qc.setQueryData(sessionKey, initial);
			qc.setQueryData(eventsKey, []);
			trpcMocks.sessionEventCreate.mockRejectedValue(new Error("boom"));

			const { result } = renderHook(
				() => useCashGameStack({ sessionId: "s1" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				result.current.recordStack({ stackAmount: 2500 });
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
