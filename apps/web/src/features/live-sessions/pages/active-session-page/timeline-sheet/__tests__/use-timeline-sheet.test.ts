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
		sessionTablePlayer: {
			list: {
				queryOptions: (input: unknown) => ({
					queryKey: buildKey("sessionTablePlayer", "list", input),
					queryFn: () => Promise.resolve({ items: [] }),
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

import { TZ_EAST, withTz } from "@/__tests__/tz";
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

const tablePlayersCashKey = (id: string) => [
	"sessionTablePlayer",
	"list",
	{ liveCashGameSessionId: id },
];

function buildTablePlayerItem(playerId: string, name: string, seat: number) {
	return {
		id: playerId,
		isActive: true,
		joinedAt: "2026-04-10T08:00:00",
		leftAt: null,
		player: { id: playerId, isTemporary: false, memo: null, name },
		seatPosition: seat,
		stints: [],
	};
}

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

		it("maps update_stack to a success dot with the resulting stack as amount and no sub when there is no entries data", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "update_stack",
				payload: { stackAmount: 51_800 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Stack update");
			expect(item?.dotClass).toBe("bg-success");
			expect(item?.sub).toBeNull();
			expect(item?.amountText).toBe("51,800");
		});

		it("builds the tournament entries-and-purchases sub for update_stack", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "update_stack",
				payload: {
					stackAmount: 48_300,
					remainingPlayers: 42,
					totalEntries: 128,
					chipPurchaseCounts: [
						{ name: "Re-entry", count: 1, chipsPerUnit: 30_000 },
					],
				},
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.sub).toBe("42 / 128 left · purchases: Re-entry ×1");
			expect(item?.amountText).toBe("48,300");
		});

		it("omits the purchases clause when every chip purchase count is zero", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "update_stack",
				payload: {
					stackAmount: 12_400,
					remainingPlayers: 96,
					totalEntries: 120,
					chipPurchaseCounts: [
						{ name: "Re-entry", count: 0, chipsPerUnit: 30_000 },
					],
				},
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBe("96 / 120 left");
		});

		it("shows entries-left alone when only remainingPlayers is present", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "update_stack",
				payload: { stackAmount: 100, remainingPlayers: 5 },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBe("5 left");
		});

		it("shows entries alone when only totalEntries is present", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "update_stack",
				payload: { stackAmount: 100, totalEntries: 10 },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBe("10 entries");
		});

		it("shows no amount for update_stack when stackAmount is missing", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "update_stack",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.amountText).toBeNull();
			expect(item?.sub).toBeNull();
		});

		it("builds the pot/equity/wins/EV-delta sub for all_in with a negative EV delta", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "all_in",
				payload: { potSize: 12_400, equity: 78, trials: 1, wins: 1 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("All-in");
			expect(item?.dotClass).toBe("bg-warning");
			expect(item?.sub).toBe(
				"Pot 12,400 · Eq 78% · 1 of 1 won · EV delta -2,728"
			);
			expect(item?.amountText).toBeNull();
		});

		it("plus-signs a positive EV delta for all_in", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "all_in",
				payload: { potSize: 12_400, equity: 78, trials: 1, wins: 0 },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBe(
				"Pot 12,400 · Eq 78% · 0 of 1 won · EV delta +9,672"
			);
		});

		it("omits the won/EV-delta clauses for all_in when trials or wins is missing", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "all_in",
				payload: { potSize: 5000, equity: 50 },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBe("Pot 5,000 · Eq 50%");
		});

		it("shows no sub for all_in when the payload is empty", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "all_in",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBeNull();
		});

		it("maps a positive chips_add_remove amount to a primary dot, a chip-add title and a plus-signed amount", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "chips_add_remove",
				payload: { amount: 5000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Chip add");
			expect(item?.dotClass).toBe("bg-primary");
			expect(item?.amountText).toBe("+5,000");
			expect(item?.sub).toBeNull();
		});

		it("maps a negative chips_add_remove amount to a destructive dot, a withdrawal title and a minus-signed amount", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "chips_add_remove",
				payload: { amount: -3000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Chip withdrawal");
			expect(item?.dotClass).toBe("bg-destructive");
			expect(item?.amountText).toBe("-3,000");
		});

		it("treats a zero chips_add_remove amount as non-negative", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "chips_add_remove",
				payload: { amount: 0 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Chip add");
			expect(item?.dotClass).toBe("bg-primary");
			expect(item?.amountText).toBe("+0");
		});

		it("falls back to no amount for chips_add_remove when amount is missing", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "chips_add_remove",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Chip add");
			expect(item?.amountText).toBeNull();
		});

		it("maps memo to an info dot with the note text folded into the title and no sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "memo",
				payload: { text: "Great table read" },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Note — Great table read");
			expect(item?.dotClass).toBe("bg-info");
			expect(item?.sub).toBeNull();
			expect(item?.amountText).toBeNull();
		});

		it("falls back to a bare Note title when memo text is missing", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "memo",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.title).toBe("Note");
		});

		it("maps purchase_chips to a primary dot, a name-suffixed title, a cost/chips sub and no amount", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "purchase_chips",
				payload: { name: "Re-entry", cost: 10_000, chips: 30_000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Chip purchase — Re-entry");
			expect(item?.dotClass).toBe("bg-primary");
			expect(item?.sub).toBe("Cost 10,000 · +30,000 chips");
			expect(item?.amountText).toBeNull();
		});

		it("falls back to a bare title for purchase_chips when the name is missing", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "purchase_chips",
				payload: { cost: 20_000, chips: 20_000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.title).toBe("Chip purchase");
		});

		it("falls back to no sub for purchase_chips when chips is missing", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "purchase_chips",
				payload: { name: "Add-on", cost: 20_000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBeNull();
		});

		it("resolves the seated player's name and seat for player_join", () => {
			const qc = createClient();
			qc.setQueryData(tablePlayersCashKey("s1"), {
				items: [buildTablePlayerItem("p1", "Young guy", 7)],
			});
			const { result } = renderWithEvent(
				{
					id: "e1",
					eventType: "player_join",
					payload: { playerId: "p1", seatPosition: 7 },
					occurredAt: "2026-04-10T09:05:00",
				},
				qc
			);
			const item = result.current.items[0];
			expect(item?.title).toBe("Young guy seated at S8");
			expect(item?.dotClass).toBe("bg-muted-foreground");
			expect(item?.sub).toBeNull();
		});

		it("falls back to a generic Player label when the join event's player isn't in the table player list", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "player_join",
				payload: { playerId: "unknown", seatPosition: 0 },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.title).toBe("Player seated at S1");
		});

		it("omits the seat clause for player_join when seatPosition is missing", () => {
			const qc = createClient();
			qc.setQueryData(tablePlayersCashKey("s1"), {
				items: [buildTablePlayerItem("p1", "Young guy", 7)],
			});
			const { result } = renderWithEvent(
				{
					id: "e1",
					eventType: "player_join",
					payload: { playerId: "p1" },
					occurredAt: "2026-04-10T09:05:00",
				},
				qc
			);
			expect(result.current.items[0]?.title).toBe("Young guy seated");
		});

		it("resolves the seated player's name for player_leave", () => {
			const qc = createClient();
			qc.setQueryData(tablePlayersCashKey("s1"), {
				items: [buildTablePlayerItem("p2", "Sunglasses", 3)],
			});
			const { result } = renderWithEvent(
				{
					id: "e1",
					eventType: "player_leave",
					payload: { playerId: "p2" },
					occurredAt: "2026-04-10T09:05:00",
				},
				qc
			);
			const item = result.current.items[0];
			expect(item?.title).toBe("Sunglasses left the table");
			expect(item?.dotClass).toBe("bg-muted-foreground");
		});

		it("maps session_pause to a warning dot titled Pause with no sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_pause",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Pause");
			expect(item?.dotClass).toBe("bg-warning");
			expect(item?.sub).toBeNull();
		});

		it("maps session_resume to a warning dot titled Resume with no sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_resume",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Resume");
			expect(item?.dotClass).toBe("bg-warning");
			expect(item?.sub).toBeNull();
		});

		it("maps session_start to a muted dot with the buy-in sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_start",
				payload: { buyInAmount: 10_000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Session start");
			expect(item?.dotClass).toBe("bg-muted-foreground");
			expect(item?.sub).toBe("Buy-in 10,000");
		});

		it("shows the local timer-start time for session_start when there is no buy-in", () => {
			withTz(TZ_EAST, () => {
				const timerStartedAt = Date.UTC(2024, 0, 1, 11, 0, 0) / 1000;
				const { result } = renderWithEvent({
					id: "e1",
					eventType: "session_start",
					payload: { timerStartedAt },
					occurredAt: "2026-04-10T09:05:00",
				});
				expect(result.current.items[0]?.sub).toBe("Timer start 20:00");
			});
		});

		it("shows no sub for session_start when neither buy-in nor timer is present", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_start",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBeNull();
		});

		it("maps session_end to a muted dot with the cash-out sub", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_end",
				payload: { cashOutAmount: 15_000 },
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.title).toBe("Session end");
			expect(item?.dotClass).toBe("bg-muted-foreground");
			expect(item?.sub).toBe("Cash-out 15,000");
		});

		it("shows a placeholder sub for session_end before the tournament deadline", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_end",
				payload: { beforeDeadline: true },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBe("- / - entries");
		});

		it("shows a placement-over-entries sub for session_end when both are present", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_end",
				payload: { placement: 5, totalEntries: 42 },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBe("#5 / 42");
		});

		it("shows a placement-only sub for session_end when totalEntries is missing", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_end",
				payload: { placement: 5 },
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBe("#5");
		});

		it("shows no sub for session_end when no known field is present", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "session_end",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			expect(result.current.items[0]?.sub).toBeNull();
		});

		it("falls back to a muted dot and the raw event type as title for an unrecognized event type", () => {
			const { result } = renderWithEvent({
				id: "e1",
				eventType: "some_future_event",
				payload: {},
				occurredAt: "2026-04-10T09:05:00",
			});
			const item = result.current.items[0];
			expect(item?.dotClass).toBe("bg-muted-foreground");
			expect(item?.title).toBe("some_future_event");
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
