import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
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
		},
		liveTournamentSession: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("liveTournamentSession", "getById", input),
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

import { useSessionEventsScene } from "@/features/live-sessions/components/session-events-scene/use-session-events-scene";
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

const cashKey = (id: string) => [
	"sessionEvent",
	"list",
	{ liveCashGameSessionId: id },
];

describe("useSessionEventsScene", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("exposes hook state (editEvent=null, confirmingDeleteId=null) and empty events by default", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useSessionEventsScene({ sessionId: "s1", sessionType: "cash_game" }),
			{ wrapper: makeWrapper(qc) }
		);
		expect(result.current.editEvent).toBeNull();
		expect(result.current.confirmingDeleteId).toBeNull();
		expect(result.current.events).toEqual([]);
		expect(result.current.isUpdatePending).toBe(false);
	});

	it("returns grouped events from the cache", () => {
		const qc = createClient();
		const events: SessionEvent[] = [
			{
				id: "e1",
				eventType: "update_stack",
				payload: { stackAmount: 100 },
				occurredAt: "2026-04-10T12:00:00",
			},
		];
		qc.setQueryData(cashKey("s1"), events);
		const { result } = renderHook(
			() =>
				useSessionEventsScene({ sessionId: "s1", sessionType: "cash_game" }),
			{ wrapper: makeWrapper(qc) }
		);
		expect(result.current.events).toHaveLength(1);
		expect(Array.isArray(result.current.groups)).toBe(true);
	});

	it("timeBounds is { minTime: null, maxTime: null } when no event is selected", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useSessionEventsScene({ sessionId: "s1", sessionType: "cash_game" }),
			{ wrapper: makeWrapper(qc) }
		);
		expect(result.current.timeBounds).toEqual({
			minTime: null,
			maxTime: null,
		});
	});

	it("timeBounds comes from getTimeBounds(events, editEvent.id) once an event is selected", () => {
		const qc = createClient();
		const events: SessionEvent[] = [
			{
				id: "e1",
				eventType: "update_stack",
				payload: {},
				occurredAt: "2026-04-10T12:00:00",
			},
			{
				id: "e2",
				eventType: "memo",
				payload: {},
				occurredAt: "2026-04-10T13:00:00",
			},
			{
				id: "e3",
				eventType: "update_stack",
				payload: {},
				occurredAt: "2026-04-10T14:00:00",
			},
		];
		qc.setQueryData(cashKey("s1"), events);
		const { result } = renderHook(
			() =>
				useSessionEventsScene({ sessionId: "s1", sessionType: "cash_game" }),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.setEditEvent(events[1]);
		});
		expect(result.current.timeBounds.minTime).toBeInstanceOf(Date);
		expect(result.current.timeBounds.maxTime).toBeInstanceOf(Date);
	});

	it("setEditEvent / setConfirmingDeleteId are independently settable", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useSessionEventsScene({ sessionId: "s1", sessionType: "cash_game" }),
			{ wrapper: makeWrapper(qc) }
		);
		act(() => {
			result.current.setConfirmingDeleteId("e1");
		});
		expect(result.current.confirmingDeleteId).toBe("e1");
		expect(result.current.editEvent).toBeNull();
	});

	it("re-exports update / deleteEvent from useSessionEvents", () => {
		const qc = createClient();
		const { result } = renderHook(
			() =>
				useSessionEventsScene({ sessionId: "s1", sessionType: "cash_game" }),
			{ wrapper: makeWrapper(qc) }
		);
		expect(typeof result.current.update).toBe("function");
		expect(typeof result.current.deleteEvent).toBe("function");
	});

	// Import reference so the module load order is not stripped by linters.
	it("uses the same useSessionEvents primitive", () => {
		expect(useSessionEvents).toBeDefined();
	});
});
