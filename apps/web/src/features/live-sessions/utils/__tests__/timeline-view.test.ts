import { describe, expect, it } from "vitest";
import {
	describeTimeline,
	resolveEditorKind,
	type TimelineEventLike,
} from "../timeline-view";

const NO_NAMES = new Map<string, string>();

function at(hour: number, minute: number) {
	return new Date(2026, 5, 1, hour, minute);
}

function event(
	eventType: string,
	payload: unknown,
	hour = 22,
	minute = 41
): TimelineEventLike {
	return {
		eventType,
		id: `${eventType}-${hour}${minute}`,
		occurredAt: at(hour, minute),
		payload,
	};
}

function firstRow(input: TimelineEventLike, names = NO_NAMES) {
	const rows = describeTimeline(
		[input],
		{ playerNames: names },
		{ includeSeatEvents: true }
	);
	const row = rows[0];
	if (!row) {
		throw new Error("expected one row");
	}
	return row;
}

describe("describeTimeline ordering", () => {
	it("lists the newest event first while keeping the server order of ties", () => {
		const rows = describeTimeline(
			[
				event("session_start", { buyInAmount: 30_000 }, 20, 0),
				event("memo", { text: "first" }, 21, 5),
				event("update_stack", { stackAmount: 51_800 }, 22, 41),
			],
			{ playerNames: NO_NAMES }
		);

		expect(rows.map((row) => row.time)).toEqual(["22:41", "21:05", "20:00"]);
	});
});

describe("describeTimeline content", () => {
	it("shows a stack update as a success row carrying the absolute stack", () => {
		const row = firstRow(event("update_stack", { stackAmount: 51_800 }));

		expect(row).toMatchObject({
			amount: "51,800",
			sub: null,
			title: "Stack update",
			tone: "success",
		});
	});

	it("summarises a tournament stack update with the field and purchase counts", () => {
		const row = firstRow(
			event("update_stack", {
				chipPurchaseCounts: [
					{ chipsPerUnit: 30_000, count: 1, name: "Re-entry" },
					{ chipsPerUnit: 20_000, count: 0, name: "Add-on" },
				],
				remainingPlayers: 42,
				stackAmount: 48_300,
				totalEntries: 128,
			})
		);

		expect(row.sub).toBe("42 / 128 left · purchases: Re-entry ×1");
	});

	it("summarises an all-in with the EV delta the server will record", () => {
		const row = firstRow(
			event("all_in", { equity: 78, potSize: 12_400, trials: 1, wins: 1 })
		);

		expect(row).toMatchObject({
			sub: "Pot 12,400 · Eq 78% · 1 of 1 won · EV delta −2,728",
			title: "All-in",
			tone: "warning",
		});
	});

	it("separates chip additions from withdrawals by title, tone and sign", () => {
		expect(
			firstRow(event("chips_add_remove", { amount: 20_000 }))
		).toMatchObject({ amount: "+20,000", title: "Chip add", tone: "primary" });
		expect(
			firstRow(event("chips_add_remove", { amount: -10_000 }))
		).toMatchObject({
			amount: "−10,000",
			title: "Chip withdrawal",
			tone: "destructive",
		});
	});

	it("names the purchase and its cost and chips", () => {
		const row = firstRow(
			event("purchase_chips", {
				chips: 30_000,
				cost: 10_000,
				name: "Re-entry",
				sessionChipPurchaseId: "p1",
			})
		);

		expect(row).toMatchObject({
			sub: "Cost 10,000 · +30,000 chips",
			title: "Chip purchase — Re-entry",
			tone: "primary",
		});
	});

	it("keeps seat events out of the timeline unless they are asked for", () => {
		const seatEvent = event("player_join", {
			isHero: false,
			playerId: "player-1",
			seatPosition: 7,
		});
		expect(describeTimeline([seatEvent], { playerNames: NO_NAMES })).toEqual(
			[]
		);
	});

	it("resolves seat events to the player's name and one-based seat", () => {
		const names = new Map([["player-1", "Young guy"]]);
		expect(
			firstRow(
				event("player_join", {
					isHero: false,
					playerId: "player-1",
					seatPosition: 7,
				}),
				names
			).title
		).toBe("Young guy seated at S8");
		expect(firstRow(event("player_leave", { isHero: true }), names).title).toBe(
			"You left the table"
		);
	});

	it("labels the session start with its cash buy-in or tournament timer", () => {
		expect(firstRow(event("session_start", { buyInAmount: 30_000 })).sub).toBe(
			"Buy-in 30,000"
		);
		expect(
			firstRow(
				event("session_start", {
					timerStartedAt: Math.floor(at(20, 0).getTime() / 1000),
				})
			).sub
		).toBe("Timer start 20:00");
	});
});

describe("timeline editing affordances", () => {
	it("refuses deletion of lifecycle events only", () => {
		expect(
			firstRow(event("session_start", { buyInAmount: 1 })).isDeletable
		).toBe(false);
		expect(
			firstRow(event("session_end", { cashOutAmount: 1 })).isDeletable
		).toBe(false);
		expect(firstRow(event("memo", { text: "note" })).isDeletable).toBe(true);
	});

	it("maps each event type to the editor that can change it", () => {
		expect(resolveEditorKind("update_stack")).toBe("stack");
		expect(resolveEditorKind("all_in")).toBe("allin");
		expect(resolveEditorKind("chips_add_remove")).toBe("chips");
		expect(resolveEditorKind("purchase_chips")).toBe("purchase");
		expect(resolveEditorKind("memo")).toBe("memo");
		expect(resolveEditorKind("player_join")).toBe("seat");
		expect(resolveEditorKind("player_leave")).toBe("seat");
		expect(resolveEditorKind("session_pause")).toBe("time");
		expect(resolveEditorKind("session_resume")).toBe("time");
		expect(resolveEditorKind("session_start")).toBe("start");
	});
});

describe("timeline rail during a pause", () => {
	it("breaks the rail between the pause and the resume that ends it", () => {
		const rows = describeTimeline(
			[
				event("session_start", { buyInAmount: 30_000 }, 20, 0),
				event("session_pause", {}, 21, 0),
				event("memo", { text: "break" }, 21, 10),
				event("session_resume", {}, 21, 30),
				event("update_stack", { stackAmount: 1000 }, 22, 0),
			],
			{ playerNames: NO_NAMES }
		);

		expect(
			rows.map((row) => [row.title, row.hasLineAbove, row.hasLineBelow])
		).toEqual([
			["Stack update", false, true],
			["Resume", true, false],
			["Note — break", false, false],
			["Pause", false, true],
			["Session start", true, false],
		]);
	});

	it("runs the rail between the outermost markers and no further", () => {
		const rows = describeTimeline(
			[
				event("session_start", { buyInAmount: 30_000 }, 20, 0),
				event("session_pause", {}, 21, 0),
			],
			{ playerNames: NO_NAMES }
		);

		expect(rows[0]).toMatchObject({
			hasLineAbove: false,
			hasLineBelow: true,
			title: "Pause",
		});
		expect(rows[1]).toMatchObject({
			hasLineAbove: true,
			hasLineBelow: false,
			title: "Session start",
		});
	});
});
