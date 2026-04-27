import { describe, expect, it } from "vitest";
import type { SessionEvent } from "@/features/live-sessions/hooks/use-session-events";
import {
	formatEventLabel,
	formatPayloadSummary,
	getTimeBounds,
	groupEventsForDisplay,
	LIFECYCLE_EVENTS,
} from "@/features/live-sessions/utils/session-events-formatters";

function event(overrides: Partial<SessionEvent> = {}): SessionEvent {
	return {
		id: "ev-1",
		eventType: "memo",
		occurredAt: "2026-04-22T12:00:00.000Z",
		payload: {},
		...overrides,
	} as SessionEvent;
}

describe("LIFECYCLE_EVENTS", () => {
	it("contains session_start and session_end only", () => {
		expect(Array.from(LIFECYCLE_EVENTS).sort()).toEqual([
			"session_end",
			"session_start",
		]);
	});
});

describe("formatEventLabel", () => {
	it.each([
		["chips_add_remove", "Chips Add/Remove"],
		["update_stack", "Stack Update"],
		["all_in", "All-in"],
		["purchase_chips", "Purchase Chips"],
		["memo", "Memo"],
		["session_pause", "Session Pause"],
		["session_resume", "Session Resume"],
		["session_start", "Session Start"],
		["session_end", "Session End"],
		["player_join", "Player Join"],
		["player_leave", "Player Leave"],
	])("maps %s -> %s", (input, expected) => {
		expect(formatEventLabel(input)).toBe(expected);
	});

	it("falls back to the raw event type when unmapped", () => {
		expect(formatEventLabel("unknown_event")).toBe("unknown_event");
	});
});

describe("formatPayloadSummary", () => {
	it("returns null when payload is null", () => {
		expect(formatPayloadSummary("memo", null)).toBeNull();
	});

	it("returns null when payload is not an object", () => {
		expect(formatPayloadSummary("memo", "string")).toBeNull();
	});

	it("returns null when no summarizer is registered", () => {
		expect(formatPayloadSummary("unknown", { text: "hi" })).toBeNull();
	});

	describe("chips_add_remove", () => {
		it("formats positive amount as Add", () => {
			expect(formatPayloadSummary("chips_add_remove", { amount: 1000 })).toBe(
				"Add: 1,000"
			);
		});

		it("formats negative amount as Remove with absolute value", () => {
			expect(formatPayloadSummary("chips_add_remove", { amount: -500 })).toBe(
				"Remove: 500"
			);
		});

		it("returns null when amount is missing", () => {
			expect(formatPayloadSummary("chips_add_remove", {})).toBeNull();
		});

		it("returns null when amount is non-numeric", () => {
			expect(
				formatPayloadSummary("chips_add_remove", { amount: "100" })
			).toBeNull();
		});
	});

	describe("update_stack", () => {
		it("formats stack amount alone", () => {
			expect(
				formatPayloadSummary("update_stack", { stackAmount: 12_345 })
			).toBe("Stack: 12,345");
		});

		it("appends remainingPlayers and totalEntries when present", () => {
			expect(
				formatPayloadSummary("update_stack", {
					stackAmount: 12_345,
					remainingPlayers: 25,
					totalEntries: 100,
				})
			).toBe("Stack: 12,345 · Remaining: 25 · Entries: 100");
		});

		it("returns null when stackAmount is missing", () => {
			expect(formatPayloadSummary("update_stack", {})).toBeNull();
		});
	});

	describe("all_in", () => {
		it("formats pot + equity", () => {
			expect(
				formatPayloadSummary("all_in", { potSize: 5000, equity: 65 })
			).toBe("Pot: 5,000 · Equity: 65%");
		});

		it("formats pot only when equity is missing", () => {
			expect(formatPayloadSummary("all_in", { potSize: 5000 })).toBe(
				"Pot: 5,000"
			);
		});

		it("formats equity only when pot is missing", () => {
			expect(formatPayloadSummary("all_in", { equity: 50 })).toBe(
				"Equity: 50%"
			);
		});

		it("returns null when neither is present", () => {
			expect(formatPayloadSummary("all_in", {})).toBeNull();
		});
	});

	describe("purchase_chips", () => {
		it("formats name + cost", () => {
			expect(
				formatPayloadSummary("purchase_chips", {
					name: "Rebuy",
					cost: 1000,
				})
			).toBe("Rebuy: 1,000");
		});

		it("returns null when name missing", () => {
			expect(formatPayloadSummary("purchase_chips", { cost: 100 })).toBeNull();
		});

		it("returns null when cost missing", () => {
			expect(
				formatPayloadSummary("purchase_chips", { name: "Rebuy" })
			).toBeNull();
		});
	});

	describe("memo", () => {
		it("returns full text when shorter than 60 chars", () => {
			expect(formatPayloadSummary("memo", { text: "short memo" })).toBe(
				"short memo"
			);
		});

		it("trims and truncates text over 60 chars with ellipsis", () => {
			const text = `${"a".repeat(65)}`;
			const result = formatPayloadSummary("memo", { text });
			expect(result).toBe(`${"a".repeat(60)}…`);
		});

		it("trims whitespace before measuring length", () => {
			expect(formatPayloadSummary("memo", { text: "  padded  " })).toBe(
				"padded"
			);
		});

		it("returns null when text is not a string", () => {
			expect(formatPayloadSummary("memo", { text: 42 })).toBeNull();
		});
	});

	describe("session_start", () => {
		it("prefers buyInAmount", () => {
			expect(
				formatPayloadSummary("session_start", { buyInAmount: 20_000 })
			).toBe("Buy-in: 20,000");
		});

		it("falls back to timerStartedAt formatted as HH:MM", () => {
			const ts = Math.floor(new Date(2026, 3, 22, 9, 5).getTime() / 1000);
			const result = formatPayloadSummary("session_start", {
				timerStartedAt: ts,
			}) as string;
			expect(result).toBe("Timer: 09:05");
		});

		it("returns null when neither is present", () => {
			expect(formatPayloadSummary("session_start", {})).toBeNull();
		});
	});

	describe("session_end", () => {
		it("prefers cashOutAmount", () => {
			expect(formatPayloadSummary("session_end", { cashOutAmount: 3200 })).toBe(
				"Cash-out: 3,200"
			);
		});

		it("shows '- / - entries' when beforeDeadline=true", () => {
			expect(
				formatPayloadSummary("session_end", { beforeDeadline: true })
			).toBe("- / - entries");
		});

		it("shows placement / totalEntries when both are numbers", () => {
			expect(
				formatPayloadSummary("session_end", {
					placement: 3,
					totalEntries: 100,
				})
			).toBe("#3 / 100");
		});

		it("shows only #placement when totalEntries is missing", () => {
			expect(formatPayloadSummary("session_end", { placement: 3 })).toBe("#3");
		});

		it("returns null when nothing matches", () => {
			expect(formatPayloadSummary("session_end", {})).toBeNull();
		});
	});

	describe("player_join / player_leave", () => {
		it("returns 'Hero' when isHero=true and seatPosition is missing", () => {
			expect(formatPayloadSummary("player_join", { isHero: true })).toBe(
				"Hero"
			);
			expect(formatPayloadSummary("player_leave", { isHero: true })).toBe(
				"Hero"
			);
		});

		it("includes the seat number on hero player_join when seatPosition is set", () => {
			expect(
				formatPayloadSummary("player_join", { isHero: true, seatPosition: 5 })
			).toBe("Hero · Seat 5");
		});

		it("returns null for non-hero joins/leaves", () => {
			expect(formatPayloadSummary("player_join", { isHero: false })).toBeNull();
		});
	});
});

describe("getTimeBounds", () => {
	const events: SessionEvent[] = [
		event({ id: "a", occurredAt: "2026-01-01T10:00:00Z" }),
		event({ id: "b", occurredAt: "2026-01-01T11:00:00Z" }),
		event({ id: "c", occurredAt: "2026-01-01T12:00:00Z" }),
	];

	it("returns null/null when target is the only event", () => {
		const only = [event({ id: "solo" })];
		expect(getTimeBounds(only, "solo")).toEqual({
			minTime: null,
			maxTime: null,
		});
	});

	it("returns null min and next max for the first event", () => {
		const { minTime, maxTime } = getTimeBounds(events, "a");
		expect(minTime).toBeNull();
		expect(maxTime?.toISOString()).toBe("2026-01-01T11:00:00.000Z");
	});

	it("returns previous min and next max for a middle event", () => {
		const { minTime, maxTime } = getTimeBounds(events, "b");
		expect(minTime?.toISOString()).toBe("2026-01-01T10:00:00.000Z");
		expect(maxTime?.toISOString()).toBe("2026-01-01T12:00:00.000Z");
	});

	it("returns previous min and null max for the last event", () => {
		const { minTime, maxTime } = getTimeBounds(events, "c");
		expect(minTime?.toISOString()).toBe("2026-01-01T11:00:00.000Z");
		expect(maxTime).toBeNull();
	});

	it("returns null min and the first event as max when target id is absent (quirk)", () => {
		// When findIndex returns -1, `index < events.length - 1` is still true,
		// so the function returns `events[0]` as maxTime. This pins the current
		// behavior — callers should pre-check presence of the id.
		const { minTime, maxTime } = getTimeBounds(events, "missing");
		expect(minTime).toBeNull();
		expect(maxTime?.toISOString()).toBe("2026-01-01T10:00:00.000Z");
	});
});

describe("groupEventsForDisplay", () => {
	it("returns empty array for empty input", () => {
		expect(groupEventsForDisplay([])).toEqual([]);
	});

	it("groups 2+ consecutive player_join/leave events into a player_group", () => {
		const events: SessionEvent[] = [
			event({ id: "1", eventType: "player_join" }),
			event({ id: "2", eventType: "player_join" }),
			event({ id: "3", eventType: "player_leave" }),
		];
		const groups = groupEventsForDisplay(events);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.type).toBe("player_group");
		if (groups[0]?.type === "player_group") {
			expect(groups[0].events).toHaveLength(3);
		}
	});

	it("emits a single-group when only one player event occurs", () => {
		const events: SessionEvent[] = [
			event({ id: "1", eventType: "player_join" }),
		];
		const groups = groupEventsForDisplay(events);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.type).toBe("single");
	});

	it("breaks grouping on a non-player event", () => {
		const events: SessionEvent[] = [
			event({ id: "1", eventType: "player_join" }),
			event({ id: "2", eventType: "player_join" }),
			event({ id: "3", eventType: "memo" }),
			event({ id: "4", eventType: "player_leave" }),
		];
		const groups = groupEventsForDisplay(events);
		// Expected: [player_group, single(memo), single(player_leave)]
		expect(groups.map((g) => g.type)).toEqual([
			"player_group",
			"single",
			"single",
		]);
	});

	it("emits singles for non-player events", () => {
		const events: SessionEvent[] = [
			event({ id: "1", eventType: "memo" }),
			event({ id: "2", eventType: "update_stack" }),
		];
		const groups = groupEventsForDisplay(events);
		expect(groups).toHaveLength(2);
		expect(groups.every((g) => g.type === "single")).toBe(true);
	});
});
