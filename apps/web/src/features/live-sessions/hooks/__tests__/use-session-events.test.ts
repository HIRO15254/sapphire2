import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function buildKey(namespace: string, procedure: string, input: unknown) {
	return input === undefined
		? [namespace, procedure]
		: [namespace, procedure, input];
}

const trpcMocks = vi.hoisted(() => ({
	update: vi.fn(),
	delete: vi.fn(),
}));

vi.mock("@/utils/trpc", () => ({
	trpc: {
		sessionEvent: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("sessionEvent", "list", input),
					queryFn: () => Promise.resolve([]),
				}),
			},
		},
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
	},
	trpcClient: {
		sessionEvent: {
			update: { mutate: trpcMocks.update },
			delete: { mutate: trpcMocks.delete },
		},
	},
}));

import {
	type SessionEvent,
	useSessionEvents,
} from "@/features/live-sessions/hooks/use-session-events";

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

function cashEventsKey(id: string) {
	return ["sessionEvent", "list", { liveCashGameSessionId: id }];
}
function tourEventsKey(id: string) {
	return ["sessionEvent", "list", { liveTournamentSessionId: id }];
}
function cashSessionKey(id: string) {
	return ["liveCashGameSession", "getById", { id }];
}
function tourSessionKey(id: string) {
	return ["liveTournamentSession", "getById", { id }];
}

describe("useSessionEvents", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("read path", () => {
		it("returns [] when cache is empty", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.events).toEqual([]);
			expect(result.current.isUpdatePending).toBe(false);
			expect(result.current.isDeletePending).toBe(false);
		});

		it("uses cash-game scoped key when sessionType is cash_game", () => {
			const qc = createClient();
			qc.setQueryData<SessionEvent[]>(cashEventsKey("s1"), [
				{ id: "e1", eventType: "memo", payload: {}, occurredAt: "t0" },
			]);
			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.events).toHaveLength(1);
		});

		it("uses tournament-scoped key when sessionType is tournament", () => {
			const qc = createClient();
			qc.setQueryData<SessionEvent[]>(tourEventsKey("t1"), [
				{ id: "e1", eventType: "memo", payload: {}, occurredAt: "t0" },
				{ id: "e2", eventType: "update_stack", payload: {}, occurredAt: "t1" },
			]);
			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "t1", sessionType: "tournament" }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.events).toHaveLength(2);
		});

		it("does not fetch when sessionId is empty (enabled gate)", () => {
			const qc = createClient();
			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.events).toEqual([]);
		});
	});

	describe("update — optimistic", () => {
		it("patches the target event's payload and occurredAt inside the events cache", async () => {
			const qc = createClient();
			qc.setQueryData<SessionEvent[]>(cashEventsKey("s1"), [
				{
					id: "e1",
					eventType: "memo",
					payload: { text: "old" },
					occurredAt: "t0",
				},
				{
					id: "e2",
					eventType: "memo",
					payload: { text: "keep" },
					occurredAt: "t0",
				},
			]);
			qc.setQueryData(cashSessionKey("s1"), {
				status: "active",
				summary: { currentStack: 100 },
			});
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.update.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);

			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.update({
					id: "e1",
					payload: { text: "new" },
					occurredAt: 1_700_000_000,
				});
			});
			await waitFor(() => {
				const events = qc.getQueryData<SessionEvent[]>(cashEventsKey("s1"));
				expect(events?.[0]?.payload).toEqual({ text: "new" });
				expect(events?.[0]?.occurredAt).toBe(
					new Date(1_700_000_000 * 1000).toISOString()
				);
				// Other event untouched.
				expect(events?.[1]?.payload).toEqual({ text: "keep" });
			});
			resolve?.({ id: "e1" });
		});

		it("keeps derived summary unchanged while an event edit is pending", async () => {
			const qc = createClient();
			qc.setQueryData<SessionEvent[]>(cashEventsKey("s1"), [
				{
					id: "e1",
					eventType: "update_stack",
					payload: { stackAmount: 100 },
					occurredAt: "t0",
				},
			]);
			qc.setQueryData(cashSessionKey("s1"), {
				status: "active",
				summary: { currentStack: 100 },
			});
			trpcMocks.update.mockResolvedValue({ id: "e1" });

			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.update({
					id: "e1",
					payload: { stackAmount: 2000 },
				});
			});
			const session = qc.getQueryData<{
				summary: { currentStack: number };
			}>(cashSessionKey("s1"));
			expect(session?.summary.currentStack).toBe(100);
		});

		it("rolls back events and session on update error", async () => {
			const qc = createClient();
			const initialEvents: SessionEvent[] = [
				{
					id: "e1",
					eventType: "update_stack",
					payload: { stackAmount: 100 },
					occurredAt: "t0",
				},
			];
			const initialSession = {
				status: "active" as const,
				summary: { currentStack: 100 },
			};
			qc.setQueryData(cashEventsKey("s1"), initialEvents);
			qc.setQueryData(cashSessionKey("s1"), initialSession);
			trpcMocks.update.mockRejectedValue(new Error("boom"));

			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await expect(
					result.current.update({
						id: "e1",
						payload: { stackAmount: 9999 },
					})
				).rejects.toThrow("boom");
			});
			await waitFor(() => {
				expect(qc.getQueryData(cashEventsKey("s1"))).toEqual(initialEvents);
				expect(qc.getQueryData(cashSessionKey("s1"))).toEqual(initialSession);
			});
		});

		it("preserves existing payload when args.payload is undefined", async () => {
			const qc = createClient();
			qc.setQueryData<SessionEvent[]>(cashEventsKey("s1"), [
				{
					id: "e1",
					eventType: "memo",
					payload: { text: "orig" },
					occurredAt: "t0",
				},
			]);
			// Keep the mutation pending so the optimistic cache is observable
			// before invalidation resets it on success.
			trpcMocks.update.mockImplementation(() => new Promise(() => undefined));
			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current
					.update({
						id: "e1",
						occurredAt: 1_700_000_000,
					})
					.catch(() => undefined);
			});
			await waitFor(() => {
				const events = qc.getQueryData<SessionEvent[]>(cashEventsKey("s1"));
				expect(events?.[0]?.occurredAt).toBe(
					new Date(1_700_000_000 * 1000).toISOString()
				);
			});
			const events = qc.getQueryData<SessionEvent[]>(cashEventsKey("s1"));
			expect(events?.[0]?.payload).toEqual({ text: "orig" });
		});

		it("flips isUpdatePending while in-flight", async () => {
			const qc = createClient();
			qc.setQueryData<SessionEvent[]>(cashEventsKey("s1"), []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.update.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.update({ id: "e1", payload: {} });
			});
			await waitFor(() => expect(result.current.isUpdatePending).toBe(true));
			resolve?.({ id: "e1" });
			await waitFor(() => expect(result.current.isUpdatePending).toBe(false));
		});
	});

	describe("delete — optimistic", () => {
		it("filters the target event out of the events cache", async () => {
			const qc = createClient();
			qc.setQueryData<SessionEvent[]>(cashEventsKey("s1"), [
				{ id: "e1", eventType: "memo", payload: {}, occurredAt: "t0" },
				{ id: "e2", eventType: "memo", payload: {}, occurredAt: "t1" },
			]);
			// Keep mutation pending so the optimistic cache is observable before
			// onSuccess invalidates.
			trpcMocks.delete.mockImplementation(() => new Promise(() => undefined));
			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.delete("e1").catch(() => undefined);
			});
			await waitFor(() => {
				const events = qc.getQueryData<SessionEvent[]>(cashEventsKey("s1"));
				expect(events?.map((e) => e.id)).toEqual(["e2"]);
			});
		});

		it("handles an empty cache gracefully (query backfills [])", async () => {
			const qc = createClient();
			trpcMocks.delete.mockResolvedValue({ id: "e1" });
			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await result.current.delete("e1");
			});
			const events = qc.getQueryData<SessionEvent[]>(cashEventsKey("s1"));
			expect(events).toEqual([]);
		});

		it("rolls back events and session on delete error", async () => {
			const qc = createClient();
			const initialEvents: SessionEvent[] = [
				{ id: "e1", eventType: "memo", payload: {}, occurredAt: "t0" },
			];
			qc.setQueryData(cashEventsKey("s1"), initialEvents);
			qc.setQueryData(cashSessionKey("s1"), { status: "active", summary: {} });
			trpcMocks.delete.mockRejectedValue(new Error("nope"));

			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			await act(async () => {
				await expect(result.current.delete("e1")).rejects.toThrow("nope");
			});
			await waitFor(() => {
				expect(qc.getQueryData(cashEventsKey("s1"))).toEqual(initialEvents);
			});
		});

		it("flips isDeletePending while in-flight", async () => {
			const qc = createClient();
			qc.setQueryData<SessionEvent[]>(cashEventsKey("s1"), []);
			let resolve: ((v: unknown) => void) | undefined;
			trpcMocks.delete.mockImplementation(
				() =>
					new Promise((r) => {
						resolve = r;
					})
			);
			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current.delete("e1");
			});
			await waitFor(() => expect(result.current.isDeletePending).toBe(true));
			resolve?.({ id: "e1" });
			await waitFor(() => expect(result.current.isDeletePending).toBe(false));
		});
	});

	describe("tournament session type", () => {
		it("operates on tournament-scoped keys", async () => {
			const qc = createClient();
			qc.setQueryData<SessionEvent[]>(tourEventsKey("t1"), [
				{
					id: "e1",
					eventType: "memo",
					payload: { text: "old" },
					occurredAt: "t0",
				},
			]);
			qc.setQueryData(tourSessionKey("t1"), {
				status: "active",
				summary: {},
			});
			// Keep mutation pending so the optimistic cache is observable before
			// onSuccess invalidation refetches.
			trpcMocks.update.mockImplementation(() => new Promise(() => undefined));
			const { result } = renderHook(
				() => useSessionEvents({ sessionId: "t1", sessionType: "tournament" }),
				{ wrapper: makeWrapper(qc) }
			);
			act(() => {
				result.current
					.update({
						id: "e1",
						payload: { text: "new" },
					})
					.catch(() => undefined);
			});
			await waitFor(() => {
				const events = qc.getQueryData<SessionEvent[]>(tourEventsKey("t1"));
				expect(events?.[0]?.payload).toEqual({ text: "new" });
			});
		});
	});
});

describe("derived live-session list invalidation", () => {
	it("invalidates cash-game lists after an event edit", async () => {
		const qc = createClient();
		qc.setQueryData(cashEventsKey("s1"), [
			{ id: "e1", eventType: "session_pause", payload: {}, occurredAt: "t0" },
		]);
		qc.setQueryData(cashSessionKey("s1"), { status: "active", summary: {} });
		trpcMocks.update.mockResolvedValue({ id: "e1" });
		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
		const { result } = renderHook(
			() => useSessionEvents({ sessionId: "s1", sessionType: "cash_game" }),
			{ wrapper: makeWrapper(qc) }
		);
		await act(async () => {
			await result.current.update({ id: "e1", payload: {} });
		});
		expect(invalidateSpy).toHaveBeenCalledTimes(3);
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["liveCashGameSession", "list", {}],
		});
	});

	it("invalidates tournament lists after an event deletion", async () => {
		const qc = createClient();
		qc.setQueryData(tourEventsKey("t1"), [
			{ id: "e1", eventType: "session_pause", payload: {}, occurredAt: "t0" },
		]);
		qc.setQueryData(tourSessionKey("t1"), { status: "active", summary: {} });
		trpcMocks.delete.mockResolvedValue({ id: "e1" });
		const invalidateSpy = vi.spyOn(qc, "invalidateQueries");
		const { result } = renderHook(
			() => useSessionEvents({ sessionId: "t1", sessionType: "tournament" }),
			{ wrapper: makeWrapper(qc) }
		);
		await act(async () => {
			await result.current.delete("e1");
		});
		expect(invalidateSpy).toHaveBeenCalledTimes(3);
		expect(invalidateSpy).toHaveBeenCalledWith({
			queryKey: ["liveTournamentSession", "list", {}],
		});
	});
});

it("does not let polling overwrite an optimistic event edit while the mutation is pending", async () => {
	vi.useFakeTimers();
	const qc = createClient();
	qc.setQueryData(cashEventsKey("s1"), [
		{ id: "e1", eventType: "memo", payload: { text: "old" }, occurredAt: "t0" },
	]);
	qc.setQueryData(cashSessionKey("s1"), { status: "active", summary: {} });
	let resolve: ((value: unknown) => void) | undefined;
	trpcMocks.update.mockImplementation(
		() =>
			new Promise((r) => {
				resolve = r;
			})
	);
	const { result } = renderHook(
		() =>
			useSessionEvents({
				sessionId: "s1",
				sessionType: "cash_game",
				refetchInterval: 10,
			}),
		{ wrapper: makeWrapper(qc) }
	);
	act(() => {
		result.current.update({ id: "e1", payload: { text: "optimistic" } });
	});
	await act(async () => {
		await vi.advanceTimersByTimeAsync(50);
	});
	expect(
		qc.getQueryData<SessionEvent[]>(cashEventsKey("s1"))?.[0]?.payload
	).toEqual({ text: "optimistic" });
	resolve?.({ id: "e1" });
	vi.useRealTimers();
});
