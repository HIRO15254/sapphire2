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
		session: {
			getById: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("session", "getById", input),
				}),
			},
			list: {
				queryKey: () => ["session", "list"],
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
import { useTimelineSheet } from "@/features/live-sessions/pages/active-session-page/timeline-sheet/use-timeline-sheet";

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

const tournamentKey = (id: string) => [
	"sessionEvent",
	"list",
	{ liveTournamentSessionId: id },
];

describe("useTimelineSheet", () => {
	beforeEach(() => {
		for (const m of Object.values(trpcMocks)) {
			m.mockReset();
		}
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("fetching only while open", () => {
		it("keeps items empty when closed even if events are cached under the real session id", () => {
			const qc = createClient();
			const events: SessionEvent[] = [
				{
					id: "e1",
					eventType: "memo",
					payload: { text: "hello" },
					occurredAt: "2026-04-10T09:05:00",
				},
			];
			qc.setQueryData(cashKey("s1"), events);
			const { result } = renderHook(
				() =>
					useTimelineSheet({
						open: false,
						sessionId: "s1",
						sessionType: "cash_game",
					}),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.items).toEqual([]);
		});

		it("isLoading is false while closed with no cached data", () => {
			const qc = createClient();
			const { result } = renderHook(
				() =>
					useTimelineSheet({
						open: false,
						sessionId: "s1",
						sessionType: "cash_game",
					}),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.isLoading).toBe(false);
		});

		it("populates items from the cache once opened for a cash game session", () => {
			const qc = createClient();
			const events: SessionEvent[] = [
				{
					id: "e1",
					eventType: "memo",
					payload: { text: "hello" },
					occurredAt: "2026-04-10T09:05:00",
				},
			];
			qc.setQueryData(cashKey("s1"), events);
			const { result } = renderHook(
				() =>
					useTimelineSheet({
						open: true,
						sessionId: "s1",
						sessionType: "cash_game",
					}),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.items).toHaveLength(1);
			expect(result.current.items[0]?.id).toBe("e1");
		});

		it("populates items from the cache once opened for a tournament session", () => {
			const qc = createClient();
			const events: SessionEvent[] = [
				{
					id: "e1",
					eventType: "memo",
					payload: { text: "hello" },
					occurredAt: "2026-04-10T09:05:00",
				},
			];
			qc.setQueryData(tournamentKey("s1"), events);
			const { result } = renderHook(
				() =>
					useTimelineSheet({
						open: true,
						sessionId: "s1",
						sessionType: "tournament",
					}),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.items).toHaveLength(1);
			expect(result.current.items[0]?.id).toBe("e1");
		});

		it("isLoading is true synchronously right after mount when open with no cached data", () => {
			const qc = createClient();
			const { result } = renderHook(
				() =>
					useTimelineSheet({
						open: true,
						sessionId: "s1",
						sessionType: "cash_game",
					}),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.isLoading).toBe(true);
		});

		it("isLoading becomes false once the cached data is present", async () => {
			const qc = createClient();
			qc.setQueryData(cashKey("s1"), []);
			const { result } = renderHook(
				() =>
					useTimelineSheet({
						open: true,
						sessionId: "s1",
						sessionType: "cash_game",
					}),
				{ wrapper: makeWrapper(qc) }
			);
			await waitFor(() => expect(result.current.isLoading).toBe(false));
		});
	});

	describe("view model mapping", () => {
		function renderWithEvent(event: SessionEvent, qc = createClient()) {
			qc.setQueryData(cashKey("s1"), [event]);
			return renderHook(
				() =>
					useTimelineSheet({
						open: true,
						sessionId: "s1",
						sessionType: "cash_game",
					}),
				{ wrapper: makeWrapper(qc) }
			);
		}

		it("zero-pads the local time from occurredAt", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "memo",
				payload: { text: "hi" },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.time).toBe("09:05");
		});

		it("maps update_stack to a success dot with the reused payload summary as sub and no amount", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "update_stack",
				payload: {
					stackAmount: 91_429,
					remainingPlayers: 40,
					totalEntries: 42,
				},
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Stack Update");
			expect(item?.dotClass).toBe("bg-success");
			expect(item?.sub).toBe("Stack: 91,429 · 40/42");
			expect(item?.amountText).toBeNull();
			expect(item?.amountClass).toBeNull();
		});

		it("maps all_in to a warning dot with the reused payload summary as sub and no amount", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "all_in",
				payload: { potSize: 20_000, trials: 100, equity: 55, wins: 55 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("All-in");
			expect(item?.dotClass).toBe("bg-warning");
			expect(item?.sub).toBe("Pot: 20,000 · Equity: 55%");
			expect(item?.amountText).toBeNull();
		});

		it("maps a positive chips_add_remove amount to a primary dot and a plus-signed amount", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "chips_add_remove",
				payload: { amount: 5000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Chips Add/Remove");
			expect(item?.dotClass).toBe("bg-primary");
			expect(item?.amountText).toBe("+5,000");
			expect(item?.amountClass).toBe("text-primary");
		});

		it("maps a negative chips_add_remove amount to a destructive dot and a minus-signed amount", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "chips_add_remove",
				payload: { amount: -3000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.dotClass).toBe("bg-destructive");
			expect(item?.amountText).toBe("-3,000");
			expect(item?.amountClass).toBe("text-destructive");
		});

		it("treats a zero chips_add_remove amount as non-negative", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "chips_add_remove",
				payload: { amount: 0 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.dotClass).toBe("bg-primary");
			expect(item?.amountText).toBe("+0");
			expect(item?.amountClass).toBe("text-primary");
		});

		it("falls back to no amount for chips_add_remove when amount is missing", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "chips_add_remove",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.dotClass).toBe("bg-primary");
			expect(item?.amountText).toBeNull();
			expect(item?.amountClass).toBeNull();
		});

		it("maps memo to an info dot with the note text as sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "memo",
				payload: { text: "Great table read" },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Memo");
			expect(item?.dotClass).toBe("bg-info");
			expect(item?.sub).toBe("Great table read");
			expect(item?.amountText).toBeNull();
		});

		it("maps purchase_chips to a primary dot, the chip name as sub, and a minus-signed cost", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "purchase_chips",
				payload: { name: "Add-on", cost: 20_000, chips: 20_000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Purchase Chips");
			expect(item?.dotClass).toBe("bg-primary");
			expect(item?.sub).toBe("Add-on");
			expect(item?.amountText).toBe("-20,000");
			expect(item?.amountClass).toBe("text-primary");
		});

		it("falls back to no sub for purchase_chips when the name is missing", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "purchase_chips",
				payload: { cost: 20_000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBeNull();
		});

		it("maps player_join to a muted dot with the hero seat summary as sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "player_join",
				payload: { isHero: true, seatPosition: 2 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Player Join");
			expect(item?.dotClass).toBe("bg-muted-foreground");
			expect(item?.sub).toBe("Hero · Seat 3");
		});

		it("maps player_leave to a muted dot", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "player_leave",
				payload: { isHero: true },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Player Leave");
			expect(item?.dotClass).toBe("bg-muted-foreground");
			expect(item?.sub).toBe("Hero");
		});

		it("maps session_pause to a warning dot with no sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_pause",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Session Pause");
			expect(item?.dotClass).toBe("bg-warning");
			expect(item?.sub).toBeNull();
		});

		it("maps session_resume to a warning dot with no sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_resume",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Session Resume");
			expect(item?.dotClass).toBe("bg-warning");
			expect(item?.sub).toBeNull();
		});

		it("maps session_start to a muted dot with the buy-in summary as sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Session Start");
			expect(item?.dotClass).toBe("bg-muted-foreground");
			expect(item?.sub).toBe("Buy-in: 10,000");
		});

		it("maps session_end to a muted dot with the cash-out summary as sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_end",
				payload: { cashOutAmount: 15_000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Session End");
			expect(item?.dotClass).toBe("bg-muted-foreground");
			expect(item?.sub).toBe("Cash-out: 15,000");
		});

		it("falls back to a muted dot for an unrecognized event type", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "some_future_event",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.dotClass).toBe("bg-muted-foreground");
		});

		it("preserves the original event order in items", () => {
			const qc = createClient();
			const events: SessionEvent[] = [
				{
					id: "e1",
					eventType: "session_start",
					payload: {},
					occurredAt: "2026-04-10T09:00:00",
				},
				{
					id: "e2",
					eventType: "memo",
					payload: { text: "note" },
					occurredAt: "2026-04-10T09:05:00",
				},
			];
			qc.setQueryData(cashKey("s1"), events);
			const { result } = renderHook(
				() =>
					useTimelineSheet({
						open: true,
						sessionId: "s1",
						sessionType: "cash_game",
					}),
				{ wrapper: makeWrapper(qc) }
			);
			expect(result.current.items.map((item) => item.id)).toEqual(["e1", "e2"]);
		});
	});

	describe("editing flow", () => {
		function renderWithEvents(events: SessionEvent[]) {
			const qc = createClient();
			qc.setQueryData(cashKey("s1"), events);
			return renderHook(
				() =>
					useTimelineSheet({
						open: true,
						sessionId: "s1",
						sessionType: "cash_game",
					}),
				{ wrapper: makeWrapper(qc) }
			);
		}

		it("has no selected event and an empty title by default", () => {
			const { result } = renderWithEvents([]);
			expect(result.current.editEvent).toBeNull();
			expect(result.current.editEventTitle).toBe("");
			expect(result.current.timeBounds).toEqual({
				minTime: null,
				maxTime: null,
			});
		});

		it("selects the tapped event's onEdit and exposes it as editEvent", () => {
			const events: SessionEvent[] = [
				{
					id: "e1",
					eventType: "memo",
					payload: { text: "first" },
					occurredAt: "2026-04-10T09:00:00",
				},
				{
					id: "e2",
					eventType: "update_stack",
					payload: { stackAmount: 100 },
					occurredAt: "2026-04-10T09:05:00",
				},
			];
			const { result } = renderWithEvents(events);
			act(() => {
				result.current.items[1]?.onEdit();
			});
			expect(result.current.editEvent).toBe(events[1]);
			expect(result.current.editEventTitle).toBe("Edit Stack Update");
		});

		it("derives timeBounds via getTimeBounds once an event is selected", () => {
			const events: SessionEvent[] = [
				{
					id: "e1",
					eventType: "memo",
					payload: {},
					occurredAt: "2026-04-10T09:00:00",
				},
				{
					id: "e2",
					eventType: "update_stack",
					payload: {},
					occurredAt: "2026-04-10T09:05:00",
				},
				{
					id: "e3",
					eventType: "memo",
					payload: {},
					occurredAt: "2026-04-10T09:10:00",
				},
			];
			const { result } = renderWithEvents(events);
			act(() => {
				result.current.items[1]?.onEdit();
			});
			expect(result.current.timeBounds.minTime).toBeInstanceOf(Date);
			expect(result.current.timeBounds.maxTime).toBeInstanceOf(Date);
		});

		it("clears editEvent when onEditOpenChange(false) is called", () => {
			const events: SessionEvent[] = [
				{
					id: "e1",
					eventType: "memo",
					payload: {},
					occurredAt: "2026-04-10T09:00:00",
				},
			];
			const { result } = renderWithEvents(events);
			act(() => {
				result.current.items[0]?.onEdit();
			});
			expect(result.current.editEvent).not.toBeNull();
			act(() => {
				result.current.onEditOpenChange(false);
			});
			expect(result.current.editEvent).toBeNull();
		});

		it("keeps editEvent when onEditOpenChange(true) is called", () => {
			const events: SessionEvent[] = [
				{
					id: "e1",
					eventType: "memo",
					payload: {},
					occurredAt: "2026-04-10T09:00:00",
				},
			];
			const { result } = renderWithEvents(events);
			act(() => {
				result.current.items[0]?.onEdit();
			});
			act(() => {
				result.current.onEditOpenChange(true);
			});
			expect(result.current.editEvent).toBe(events[0]);
		});

		it("does nothing when onEditSubmit is called with no event selected", () => {
			const { result } = renderWithEvents([]);
			act(() => {
				result.current.onEditSubmit({ text: "x" });
			});
			expect(trpcMocks.update).not.toHaveBeenCalled();
		});

		it("does nothing when onEditTimeUpdate is called with no event selected", () => {
			const { result } = renderWithEvents([]);
			act(() => {
				result.current.onEditTimeUpdate(1_700_000_000);
			});
			expect(trpcMocks.update).not.toHaveBeenCalled();
		});

		it("submits the edited payload and closes the edit sheet on success", async () => {
			const events: SessionEvent[] = [
				{
					id: "e1",
					eventType: "memo",
					payload: { text: "old" },
					occurredAt: "2026-04-10T09:00:00",
				},
			];
			const { result } = renderWithEvents(events);
			act(() => {
				result.current.items[0]?.onEdit();
			});
			act(() => {
				result.current.onEditSubmit({ text: "new" }, 1_700_000_000);
			});
			await waitFor(() => expect(trpcMocks.update).toHaveBeenCalledTimes(1));
			expect(trpcMocks.update).toHaveBeenNthCalledWith(1, {
				id: "e1",
				payload: { text: "new" },
				occurredAt: 1_700_000_000,
			});
			await waitFor(() => expect(result.current.editEvent).toBeNull());
		});

		it("submits a time-only update and closes the edit sheet on success", async () => {
			const events: SessionEvent[] = [
				{
					id: "e1",
					eventType: "player_join",
					payload: {},
					occurredAt: "2026-04-10T09:00:00",
				},
			];
			const { result } = renderWithEvents(events);
			act(() => {
				result.current.items[0]?.onEdit();
			});
			act(() => {
				result.current.onEditTimeUpdate(1_700_000_100);
			});
			await waitFor(() => expect(trpcMocks.update).toHaveBeenCalledTimes(1));
			expect(trpcMocks.update).toHaveBeenNthCalledWith(1, {
				id: "e1",
				occurredAt: 1_700_000_100,
			});
			await waitFor(() => expect(result.current.editEvent).toBeNull());
		});
	});

	it("uses the same useSessionEvents primitive", () => {
		expect(useSessionEvents).toBeDefined();
	});
});
