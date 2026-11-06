import { describe, expect, it } from "vitest";
import {
	type EntryProjection,
	type ProjectorContext,
	type ProjectorEvent,
	projectEntry,
	projectTournamentProgress,
} from "../services/entry-projector";

const START = Date.parse("2026-09-05T10:00:00.000Z");
const TIMER_STARTED_AT = Math.floor(START / 1000) - 600;

function at(minute: number): Date {
	return new Date(START + minute * 60_000);
}

function ev(
	type: string,
	minute: number,
	payload: Record<string, unknown> = {},
	options: { playSessionId?: string; sortOrder?: number } = {}
): ProjectorEvent {
	const playSessionId = options.playSessionId ?? "day-1";
	const sortOrder = options.sortOrder ?? minute * 10;
	return {
		id: `${playSessionId}-${sortOrder}`,
		occurredAt: at(minute),
		payload: JSON.stringify(payload),
		playSessionId,
		sortOrder,
		type,
	};
}

const oneDay = [{ id: "day-1", localDate: "2026-09-05", seq: 1 }];
const twoDays = [
	{ id: "day-1", localDate: "2026-09-05", seq: 1 },
	{ id: "day-2", localDate: "2026-09-06", seq: 2 },
];
function contextFor(
	kind: ProjectorContext["kind"],
	playSessions: ProjectorContext["playSessions"] = oneDay
): ProjectorContext {
	return {
		kind,
		playSessions,
	};
}
const cash = contextFor("cash");
const tournament = contextFor("tournament");

it("rejects overflowing tournament chip totals", () => {
	const payload = { label: "chips", payments: [], priceId: "price" };
	const safe = ev("purchase_chips", 1, {
		...payload,
		chips: Number.MAX_SAFE_INTEGER,
	});
	expect(projectTournamentProgress([safe], null).chipTotal).toBe(
		Number.MAX_SAFE_INTEGER
	);
	expect(() =>
		projectTournamentProgress(
			[safe, ev("purchase_chips", 2, { ...payload, chips: 1 })],
			null
		)
	).toThrow("Integer total exceeds the safe integer range");
});

function onlySession(projection: EntryProjection) {
	expect(projection.playSessions).toHaveLength(1);
	return projection.playSessions[0];
}

describe("projectEntry: session_start", () => {
	it("starts the play session and keeps the entry open", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
				}),
			],
			cash
		);
		expect(onlySession(projection)).toEqual({
			breakMinutes: 0,
			clockStartedAt: null,
			clockStartLevel: null,
			endedAt: null,
			endStack: null,
			endState: null,
			id: "day-1",
			startedAt: at(0),
			status: "active",
		});
		expect(projection.status).toBe("open");
		expect(projection.playedOn).toBe("2026-09-05");
		expect(projection.detail).toEqual({ evDiff: 0, kind: "cash" });
	});

	it("reads the tournament clock from timerStartedAt in seconds", () => {
		const projection = projectEntry(
			[ev("session_start", 0, { timerStartedAt: TIMER_STARTED_AT })],
			tournament
		);
		expect(onlySession(projection)).toMatchObject({
			clockStartedAt: new Date(TIMER_STARTED_AT * 1000),
			clockStartLevel: null,
		});
	});

	it("reads the clock and starting level from a payload with payments", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, {
					payments: [
						{ assetId: "jpy", quantity: 10_000, role: "buy_in" },
						{ assetId: "jpy", quantity: 1000, role: "fee" },
					],
					startLevel: 15,
					timerStartedAt: TIMER_STARTED_AT,
				}),
			],
			tournament
		);
		expect(onlySession(projection)).toMatchObject({
			clockStartedAt: new Date(TIMER_STARTED_AT * 1000),
			clockStartLevel: 15,
			startedAt: at(0),
		});
	});

	it("rejects a payment whose role the event does not allow", () => {
		expect(() =>
			projectEntry(
				[
					ev("session_start", 0, {
						payments: [{ assetId: "jpy", quantity: 10_000, role: "cash_out" }],
					}),
				],
				cash
			)
		).toThrow();
	});
});

describe("projectEntry: session_pause / session_resume", () => {
	it("pauses the play session and counts only finished breaks", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
				}),
				ev("session_pause", 30),
				ev("session_resume", 45),
				ev("session_pause", 60),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			breakMinutes: 15,
			status: "paused",
		});
	});

	it("resumes the play session and sums every pause-to-resume span", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
				}),
				ev("session_pause", 30),
				ev("session_resume", 45),
				ev("session_pause", 60),
				ev("session_resume", 80),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			breakMinutes: 35,
			status: "active",
		});
	});

	it("rounds a break down to whole minutes", () => {
		const resume = ev("session_resume", 10);
		resume.occurredAt = new Date(at(10).getTime() + 59_000);
		const projection = projectEntry(
			[
				ev("session_start", 0, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
				}),
				ev("session_pause", 5),
				resume,
			],
			cash
		);
		expect(onlySession(projection)?.breakMinutes).toBe(5);
	});

	it("closes a pause left open by the end event at the end time", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
				}),
				ev("session_pause", 60),
				ev("session_end", 90, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "cash_out" }],
				}),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			breakMinutes: 30,
			status: "ended",
		});
	});
});

describe("projectEntry: event order", () => {
	it("folds events by occurred_at regardless of the input order", () => {
		const projection = projectEntry(
			[
				ev("session_resume", 45),
				ev("session_start", 0, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
				}),
				ev("session_pause", 30),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			breakMinutes: 15,
			startedAt: at(0),
			status: "active",
		});
	});

	it("breaks an occurred_at tie with sort_order", () => {
		const start = ev("session_start", 0, {
			payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
		});
		const pauseFirst = projectEntry(
			[
				start,
				ev("session_resume", 30, {}, { sortOrder: 2 }),
				ev("session_pause", 30, {}, { sortOrder: 1 }),
			],
			cash
		);
		const resumeFirst = projectEntry(
			[
				start,
				ev("session_resume", 30, {}, { sortOrder: 1 }),
				ev("session_pause", 30, {}, { sortOrder: 2 }),
			],
			cash
		);
		expect(onlySession(pauseFirst)?.status).toBe("active");
		expect(onlySession(resumeFirst)?.status).toBe("paused");
	});
});

describe("projectEntry: all_in", () => {
	const allIns = [
		ev("session_start", 0, {
			payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
		}),
		ev("all_in", 10, { equity: 40, potSize: 1000, trials: 1, wins: 0 }),
		ev("all_in", 20, {
			equity: 50,
			handId: "hand-1",
			potSize: 101,
			trials: 1,
			wins: 0,
		}),
	];

	it("stores the rounded EV difference of every all-in once the entry settles", () => {
		const projection = projectEntry(
			[
				...allIns,
				ev("session_end", 60, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "cash_out" }],
				}),
			],
			cash
		);
		expect(projection.detail).toEqual({ evDiff: 451, kind: "cash" });
	});

	it("projects the same EV difference while the entry is still open", () => {
		expect(projectEntry(allIns, cash).detail).toEqual({
			evDiff: 451,
			kind: "cash",
		});
	});
});

describe("projectEntry: events without a play-session or detail projection", () => {
	it("leaves play sessions and detail unchanged for chip, seat, memo, table and re-entry events", () => {
		const base = [
			ev("session_start", 0, {
				payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
			}),
			ev("session_end", 90, {
				payments: [{ assetId: "jpy", quantity: 30_000, role: "cash_out" }],
			}),
		];
		const noisy = [
			...base,
			ev("chips_add_remove", 10, {
				amount: 10_000,
				assetId: "jpy",
				effect: "real",
			}),
			ev("chips_add_remove", 20, {
				amount: -5000,
				assetId: "jpy",
				effect: "real",
			}),
			ev("purchase_chips", 25, {
				chips: 10_000,
				label: "Rebuy",
				payments: [{ assetId: "jpy", quantity: 5000, role: "chip_purchase" }],
				priceId: "rebuy",
			}),
			ev("reentry", 26, { payments: [] }),
			ev("table_change", 30, { tableLabel: "T5" }),
			ev("player_join", 40, { playerId: "hero", seatPosition: 3 }),
			ev("player_leave", 50, { playerId: "hero" }),
			ev("memo", 60, { text: "note" }),
		];
		const { lines: _noisyLines, ...noisyProjection } = projectEntry(
			noisy,
			cash
		);
		const { lines: _baseLines, ...baseProjection } = projectEntry(base, cash);
		expect(noisyProjection).toEqual(baseProjection);
	});
});

describe("projectEntry: update_stack", () => {
	it("clears a previously reported total when an update explicitly sets null", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0),
				ev("update_stack", 10, { stackAmount: 25_000, totalEntries: 120 }),
				ev("update_stack", 20, { stackAmount: 30_000, totalEntries: null }),
				ev("update_stack", 30, { stackAmount: 28_000 }),
			],
			tournament
		);
		expect(projection.detail).toMatchObject({ totalEntries: null });
	});

	it("takes total entries from the latest stack update that reports them", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0),
				ev("update_stack", 10, {
					chipPurchaseCounts: [
						{ chipsPerUnit: 10_000, count: 1, name: "Rebuy" },
					],
					stackAmount: 25_000,
					totalEntries: 120,
				}),
				ev("update_stack", 20, {
					remainingPlayers: 90,
					stackAmount: 31_000,
					totalEntries: 135,
				}),
				ev("update_stack", 30, { stackAmount: 28_000 }),
			],
			tournament
		);
		expect(projection.detail).toEqual({
			beforeDeadline: false,
			kind: "tournament",
			placement: null,
			totalEntries: 135,
		});
	});
});

describe("projectEntry: day_end", () => {
	it("bags a tournament day and keeps the entry open", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0),
				ev("day_end", 300, { endState: "bagged", stackAmount: 48_000 }),
			],
			tournament
		);
		expect(onlySession(projection)).toMatchObject({
			endedAt: at(300),
			endStack: 48_000,
			endState: "bagged",
			status: "ended",
		});
		expect(projection.status).toBe("open");
	});

	it("holds a cash stack and keeps the entry open", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
				}),
				ev("day_end", 120, { endState: "held", stackAmount: 41_000 }),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			endStack: 41_000,
			endState: "held",
			status: "ended",
		});
		expect(projection.status).toBe("open");
	});
});

describe("projectEntry: session_end (cash)", () => {
	it("cashes out with the cash-out as the end stack and settles the entry", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
				}),
				ev("session_end", 180, {
					payments: [{ assetId: "jpy", quantity: 45_000, role: "cash_out" }],
				}),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			endedAt: at(180),
			endStack: 45_000,
			endState: "cashed_out",
			status: "ended",
		});
		expect(projection.status).toBe("settled");
		expect(projection.detail).toEqual({ evDiff: 0, kind: "cash" });
	});

	it("reads the end stack from cash_out payments", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
				}),
				ev("session_end", 180, {
					payments: [{ assetId: "jpy", quantity: 45_000, role: "cash_out" }],
				}),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			endStack: 45_000,
			endState: "cashed_out",
		});
		expect(projection.status).toBe("settled");
	});
});

describe("projectEntry: session_end (tournament)", () => {
	const started = [
		ev("session_start", 0),
		ev("update_stack", 10, { stackAmount: 20_000, totalEntries: 70 }),
	];

	it("finishes a win and records the result", () => {
		const projection = projectEntry(
			[
				...started,
				ev("session_end", 400, {
					beforeDeadline: false,
					payments: [{ assetId: "jpy", quantity: 300_000, role: "prize" }],
					placement: 1,
					totalEntries: 80,
				}),
			],
			tournament
		);
		expect(onlySession(projection)).toMatchObject({
			endedAt: at(400),
			endStack: null,
			endState: "finished",
			status: "ended",
		});
		expect(projection.status).toBe("settled");
		expect(projection.detail).toEqual({
			beforeDeadline: false,
			kind: "tournament",
			placement: 1,
			totalEntries: 80,
		});
	});

	it("busts any other placement", () => {
		const projection = projectEntry(
			[
				...started,
				ev("session_end", 400, {
					beforeDeadline: false,
					payments: [
						{ assetId: "jpy", quantity: 20_000, role: "prize" },
						{ assetId: "jpy", quantity: 5000, role: "bounty" },
					],
					placement: 7,
					totalEntries: 80,
				}),
			],
			tournament
		);
		expect(onlySession(projection)?.endState).toBe("busted");
		expect(projection.detail).toMatchObject({ placement: 7, totalEntries: 80 });
	});

	it("busts before the deadline with no placement or total entries", () => {
		const projection = projectEntry(
			[
				...started,
				ev("session_end", 100, {
					beforeDeadline: true,
					payments: [],
				}),
			],
			tournament
		);
		expect(onlySession(projection)?.endState).toBe("busted");
		expect(projection.status).toBe("settled");
		expect(projection.detail).toEqual({
			beforeDeadline: true,
			kind: "tournament",
			placement: null,
			totalEntries: null,
		});
	});

	it("reads the result from a payload with prize payments", () => {
		const projection = projectEntry(
			[
				...started,
				ev("session_end", 400, {
					beforeDeadline: false,
					payments: [
						{ assetId: "ticket", quantity: 1, role: "prize" },
						{ assetId: "jpy", quantity: 5000, role: "bounty" },
					],
					placement: 3,
					totalEntries: 80,
				}),
			],
			tournament
		);
		expect(onlySession(projection)?.endState).toBe("busted");
		expect(projection.detail).toEqual({
			beforeDeadline: false,
			kind: "tournament",
			placement: 3,
			totalEntries: 80,
		});
	});
});

describe("projectEntry: several play sessions (§13.3)", () => {
	const day2 = { playSessionId: "day-2" };
	const multiDay = contextFor("tournament", [...twoDays].reverse());
	const dayOne = [
		ev("session_start", 0, { timerStartedAt: TIMER_STARTED_AT }),
		ev("update_stack", 100, { stackAmount: 50_000, totalEntries: 200 }),
		ev("day_end", 300, { endState: "bagged", stackAmount: 61_000 }),
	];
	const dayTwoStart = ev(
		"session_start",
		1440,
		{ startLevel: 15, timerStartedAt: TIMER_STARTED_AT + 86_400 },
		day2
	);

	it("keeps a bagged entry open while the next day plays", () => {
		const projection = projectEntry([...dayOne, dayTwoStart], multiDay);
		expect(projection.playSessions.map((session) => session.id)).toEqual([
			"day-1",
			"day-2",
		]);
		expect(projection.playSessions[0]).toMatchObject({
			clockStartLevel: null,
			endStack: 61_000,
			endState: "bagged",
			status: "ended",
		});
		expect(projection.playSessions[1]).toMatchObject({
			clockStartedAt: new Date((TIMER_STARTED_AT + 86_400) * 1000),
			clockStartLevel: 15,
			startedAt: at(1440),
			status: "active",
		});
		expect(projection.status).toBe("open");
		expect(projection.playedOn).toBe("2026-09-05");
		expect(projection.detail).toMatchObject({ totalEntries: 200 });
	});

	it("settles when the last day ends", () => {
		const projection = projectEntry(
			[
				...dayOne,
				dayTwoStart,
				ev(
					"session_end",
					1700,
					{
						beforeDeadline: false,
						payments: [{ assetId: "jpy", quantity: 80_000, role: "prize" }],
						placement: 4,
						totalEntries: 200,
					},
					day2
				),
			],
			multiDay
		);
		expect(projection.status).toBe("settled");
		expect(projection.detail).toEqual({
			beforeDeadline: false,
			kind: "tournament",
			placement: 4,
			totalEntries: 200,
		});
	});

	it("reopens a busted tournament for a re-entry and drops the earlier result", () => {
		const firstBullet = [
			ev("session_start", 0),
			ev("session_end", 60, {
				beforeDeadline: false,
				payments: [],
				placement: 150,
				totalEntries: 150,
			}),
		];
		const reentered = projectEntry(
			[...firstBullet, ev("session_start", 70, {}, day2)],
			contextFor("tournament", twoDays)
		);
		expect(reentered.playSessions[0]?.endState).toBe("busted");
		expect(reentered.status).toBe("open");
		expect(reentered.detail).toMatchObject({ placement: null });

		const finished = projectEntry(
			[
				...firstBullet,
				ev("session_start", 70, {}, day2),
				ev(
					"session_end",
					400,
					{
						beforeDeadline: false,
						payments: [{ assetId: "jpy", quantity: 120_000, role: "prize" }],
						placement: 2,
						totalEntries: 180,
					},
					day2
				),
			],
			contextFor("tournament", twoDays)
		);
		expect(finished.status).toBe("settled");
		expect(finished.detail).toMatchObject({ placement: 2, totalEntries: 180 });
	});

	it("sums EV over every play session of a cash entry that resumed after held", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, {
					payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
				}),
				ev("all_in", 10, { equity: 40, potSize: 1000, trials: 1, wins: 0 }),
				ev("day_end", 60, { endState: "held", stackAmount: 35_000 }),
				ev("session_start", 120, {}, day2),
				ev(
					"all_in",
					130,
					{ equity: 25, potSize: 2000, trials: 2, wins: 1 },
					day2
				),
				ev(
					"session_end",
					200,
					{
						payments: [{ assetId: "jpy", quantity: 20_000, role: "cash_out" }],
					},
					day2
				),
			],
			contextFor("cash", twoDays)
		);
		expect(projection.playSessions.map((session) => session.endState)).toEqual([
			"held",
			"cashed_out",
		]);
		expect(projection.status).toBe("settled");
		expect(projection.detail).toEqual({ evDiff: -100, kind: "cash" });
	});

	it("rejects an event whose play session is not part of the entry", () => {
		expect(() =>
			projectEntry(
				[ev("session_start", 0, {}, { playSessionId: "elsewhere" })],
				cash
			)
		).toThrow("outside the entry");
	});
});

function lineSummary(projection: EntryProjection) {
	return projection.lines.map(({ id, assetId, quantity, role, effect }) => ({
		assetId,
		effect,
		id,
		quantity,
		role,
	}));
}

describe("projectEntry: ledger lines (§13.2)", () => {
	it("signs cash buy-ins, add-ons, chip removals and the cash-out in their asset", () => {
		const start = ev("session_start", 0, {
			payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
		});
		const addon = ev("chips_add_remove", 10, {
			amount: 10_000,
			assetId: "jpy",
			effect: "real",
		});
		const remove = ev("chips_add_remove", 20, {
			amount: -5000,
			assetId: "jpy",
			effect: "real",
		});
		const end = ev("session_end", 90, {
			payments: [{ assetId: "jpy", quantity: 52_000, role: "cash_out" }],
		});
		const projection = projectEntry([end, remove, addon, start], cash);
		expect(lineSummary(projection)).toEqual([
			{
				assetId: "jpy",
				effect: "real",
				id: `${start.id}:0`,
				quantity: -30_000,
				role: "buy_in",
			},
			{
				assetId: "jpy",
				effect: "real",
				id: `${addon.id}:0`,
				quantity: -10_000,
				role: "addon",
			},
			{
				assetId: "jpy",
				effect: "real",
				id: `${remove.id}:0`,
				quantity: 5000,
				role: "chip_remove",
			},
			{
				assetId: "jpy",
				effect: "real",
				id: `${end.id}:0`,
				quantity: 52_000,
				role: "cash_out",
			},
		]);
		expect(projection.lines[3]).toMatchObject({
			occurredAt: at(90),
			playSessionId: "day-1",
			sourceEventId: end.id,
		});
	});

	it("writes no line for a zero cash-out or an end event the play session has moved past", () => {
		expect(
			lineSummary(
				projectEntry(
					[
						ev("session_start", 0, {
							payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
						}),
						ev("session_end", 90, { payments: [] }),
					],
					cash
				)
			).map((line) => line.role)
		).toEqual(["buy_in"]);
		expect(
			lineSummary(
				projectEntry(
					[
						ev("session_start", 0, {
							payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }],
						}),
						ev("session_end", 90, {
							payments: [
								{ assetId: "jpy", quantity: 40_000, role: "cash_out" },
							],
						}),
						ev("session_start", 100, { payments: [] }),
					],
					cash
				)
			).map((line) => line.role)
		).toEqual(["buy_in"]);
	});

	it("projects tournament buy-in and fee, chip purchase, and closing prizes", () => {
		const firstStart = ev("session_start", 0, {
			payments: [
				{ assetId: "jpy", quantity: 10_000, role: "buy_in" },
				{ assetId: "jpy", quantity: 1000, role: "fee" },
			],
		});
		const rebuy = ev("purchase_chips", 30, {
			chips: 10_000,
			label: "Rebuy",
			payments: [{ assetId: "jpy", quantity: 5000, role: "chip_purchase" }],
			priceId: "rebuy",
		});
		const bust = ev("session_end", 60, {
			beforeDeadline: false,
			payments: [],
			placement: 150,
			totalEntries: 150,
		});
		const day2 = { playSessionId: "day-2" };
		const finalEnd = ev(
			"session_end",
			400,
			{
				beforeDeadline: false,
				payments: [
					{ assetId: "jpy", quantity: 120_000, role: "prize" },
					{ assetId: "jpy", quantity: 4000, role: "bounty" },
				],
				placement: 2,
				totalEntries: 180,
			},
			day2
		);
		const projection = projectEntry(
			[firstStart, rebuy, bust, ev("session_start", 70, {}, day2), finalEnd],
			contextFor("tournament", twoDays)
		);
		expect(lineSummary(projection)).toEqual([
			{
				assetId: "jpy",
				effect: "real",
				id: `${firstStart.id}:0`,
				quantity: -10_000,
				role: "buy_in",
			},
			{
				assetId: "jpy",
				effect: "real",
				id: `${firstStart.id}:1`,
				quantity: -1000,
				role: "fee",
			},
			{
				assetId: "jpy",
				effect: "real",
				id: `${rebuy.id}:0`,
				quantity: -5000,
				role: "chip_purchase",
			},
			{
				assetId: "jpy",
				effect: "real",
				id: `${finalEnd.id}:0`,
				quantity: 120_000,
				role: "prize",
			},
			{
				assetId: "jpy",
				effect: "real",
				id: `${finalEnd.id}:1`,
				quantity: 4000,
				role: "bounty",
			},
		]);
		expect(projection.lines[4]?.playSessionId).toBe("day-2");
	});

	it("writes payments in their own assets and effects, one line each", () => {
		const start = ev("session_start", 0, {
			payments: [
				{ assetId: "ticket", quantity: 1, role: "buy_in" },
				{ assetId: "pt", effect: "virtual", quantity: 500, role: "fee" },
			],
		});
		const reentry = ev("reentry", 60, {
			payments: [
				{ assetId: "pt", quantity: 20_000, role: "reentry" },
				{ assetId: "pt", quantity: 500, role: "fee" },
			],
		});
		const addon = ev("purchase_chips", 90, {
			chips: 20_000,
			label: "Add-on",
			payments: [{ assetId: "pt", quantity: 3000, role: "chip_purchase" }],
			priceId: "addon-price",
		});
		const end = ev("session_end", 400, {
			beforeDeadline: false,
			payments: [
				{ assetId: "main-ticket", quantity: 1, role: "prize" },
				{ assetId: "pt", quantity: 2000, role: "bounty" },
			],
			placement: 3,
			totalEntries: 90,
		});
		const projection = projectEntry([start, reentry, addon, end], tournament);
		expect(lineSummary(projection)).toEqual([
			{
				assetId: "ticket",
				effect: "real",
				id: `${start.id}:0`,
				quantity: -1,
				role: "buy_in",
			},
			{
				assetId: "pt",
				effect: "virtual",
				id: `${start.id}:1`,
				quantity: -500,
				role: "fee",
			},
			{
				assetId: "pt",
				effect: "real",
				id: `${reentry.id}:0`,
				quantity: -20_000,
				role: "reentry",
			},
			{
				assetId: "pt",
				effect: "real",
				id: `${reentry.id}:1`,
				quantity: -500,
				role: "fee",
			},
			{
				assetId: "pt",
				effect: "real",
				id: `${addon.id}:0`,
				quantity: -3000,
				role: "chip_purchase",
			},
			{
				assetId: "main-ticket",
				effect: "real",
				id: `${end.id}:0`,
				quantity: 1,
				role: "prize",
			},
			{
				assetId: "pt",
				effect: "real",
				id: `${end.id}:1`,
				quantity: 2000,
				role: "bounty",
			},
		]);
	});
});
