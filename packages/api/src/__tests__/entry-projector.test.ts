import { describe, expect, it } from "vitest";
import {
	type EntryProjection,
	type ProjectorContext,
	type ProjectorEvent,
	projectEntry,
} from "../services/entry-projector";
import {
	computeBreakMinutesFromEvents,
	computeCashGamePLFromEvents,
	computeSessionStateFromEvents,
	computeTournamentPLFromEvents,
} from "../services/live-session-pl";

const START = Date.parse("2026-09-05T10:00:00.000Z");
const TIMER_STARTED_AT = Math.floor(START / 1000) - 600;

function at(minute: number): Date {
	return new Date(START + minute * 60_000);
}

function ev(
	type: string,
	minute: number,
	payload: Record<string, unknown> = {},
	options: { playSessionId?: string; sortOrder?: number; version?: number } = {}
): ProjectorEvent {
	const playSessionId = options.playSessionId ?? "day-1";
	const sortOrder = options.sortOrder ?? minute * 10;
	return {
		id: `${playSessionId}-${sortOrder}`,
		playSessionId,
		type,
		schemaVersion: options.version ?? 1,
		occurredAt: at(minute),
		sortOrder,
		payload: JSON.stringify(payload),
	};
}

const oneDay = [{ id: "day-1", seq: 1, localDate: "2026-09-05" }];
const twoDays = [
	{ id: "day-1", seq: 1, localDate: "2026-09-05" },
	{ id: "day-2", seq: 2, localDate: "2026-09-06" },
];
const cash: ProjectorContext = { kind: "cash", playSessions: oneDay };
const tournament: ProjectorContext = {
	kind: "tournament",
	playSessions: oneDay,
};

function onlySession(projection: EntryProjection) {
	expect(projection.playSessions).toHaveLength(1);
	return projection.playSessions[0];
}

describe("projectEntry: session_start", () => {
	it("starts the play session and keeps the entry open", () => {
		const projection = projectEntry(
			[ev("session_start", 0, { buyInAmount: 30_000 })],
			cash
		);
		expect(onlySession(projection)).toEqual({
			id: "day-1",
			startedAt: at(0),
			endedAt: null,
			breakMinutes: 0,
			status: "active",
			endState: null,
			endStack: null,
			clockStartedAt: null,
			clockStartLevel: null,
		});
		expect(projection.status).toBe("open");
		expect(projection.playedOn).toBe("2026-09-05");
		expect(projection.detail).toEqual({ kind: "cash", evDiff: null });
	});

	it("reads the tournament clock from a v1 timerStartedAt in seconds", () => {
		const projection = projectEntry(
			[ev("session_start", 0, { timerStartedAt: TIMER_STARTED_AT })],
			tournament
		);
		expect(onlySession(projection)).toMatchObject({
			clockStartedAt: new Date(TIMER_STARTED_AT * 1000),
			clockStartLevel: null,
		});
	});

	it("reads the clock and starting level from a v2 payload with payments", () => {
		const projection = projectEntry(
			[
				ev(
					"session_start",
					0,
					{
						timerStartedAt: TIMER_STARTED_AT,
						startLevel: 15,
						payments: [
							{ assetId: "jpy", quantity: 10_000, role: "buy_in" },
							{ assetId: "jpy", quantity: 1000, role: "fee" },
						],
					},
					{ version: 2 }
				),
			],
			tournament
		);
		expect(onlySession(projection)).toMatchObject({
			startedAt: at(0),
			clockStartedAt: new Date(TIMER_STARTED_AT * 1000),
			clockStartLevel: 15,
		});
	});

	it("rejects a v2 payment whose role the event does not allow", () => {
		expect(() =>
			projectEntry(
				[
					ev(
						"session_start",
						0,
						{
							payments: [
								{ assetId: "jpy", quantity: 10_000, role: "cash_out" },
							],
						},
						{ version: 2 }
					),
				],
				cash
			)
		).toThrow();
	});

	it("rejects a payload schema version it does not know", () => {
		expect(() =>
			projectEntry([ev("session_start", 0, {}, { version: 3 })], cash)
		).toThrow("Unsupported payload schema version 3");
	});
});

describe("projectEntry: session_pause / session_resume", () => {
	it("pauses the play session and counts only finished breaks", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0),
				ev("session_pause", 30),
				ev("session_resume", 45),
				ev("session_pause", 60),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			status: "paused",
			breakMinutes: 15,
		});
	});

	it("resumes the play session and sums every pause-to-resume span", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0),
				ev("session_pause", 30),
				ev("session_resume", 45),
				ev("session_pause", 60),
				ev("session_resume", 80),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			status: "active",
			breakMinutes: 35,
		});
	});

	it("rounds a break down to whole minutes", () => {
		const resume = ev("session_resume", 10);
		resume.occurredAt = new Date(at(10).getTime() + 59_000);
		const projection = projectEntry(
			[ev("session_start", 0), ev("session_pause", 5), resume],
			cash
		);
		expect(onlySession(projection)?.breakMinutes).toBe(5);
	});

	it("closes a pause left open by the end event at the end time", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0),
				ev("session_pause", 60),
				ev("session_end", 90, { cashOutAmount: 30_000 }),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			status: "ended",
			breakMinutes: 30,
		});
	});
});

describe("projectEntry: event order", () => {
	it("folds events by occurred_at regardless of the input order", () => {
		const projection = projectEntry(
			[
				ev("session_resume", 45),
				ev("session_start", 0),
				ev("session_pause", 30),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			startedAt: at(0),
			status: "active",
			breakMinutes: 15,
		});
	});

	it("breaks an occurred_at tie with sort_order", () => {
		const start = ev("session_start", 0);
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
		ev("session_start", 0, { buyInAmount: 30_000 }),
		ev("all_in", 10, { potSize: 1000, trials: 1, equity: 40, wins: 0 }),
		ev(
			"all_in",
			20,
			{ potSize: 101, trials: 1, equity: 50, wins: 0, handId: "hand-1" },
			{ version: 2 }
		),
	];

	it("stores the rounded EV difference of every all-in once the entry settles", () => {
		const projection = projectEntry(
			[...allIns, ev("session_end", 60, { cashOutAmount: 30_000 })],
			cash
		);
		expect(projection.detail).toEqual({ kind: "cash", evDiff: 451 });
	});

	it("leaves EV unrecorded while the entry is open", () => {
		expect(projectEntry(allIns, cash).detail).toEqual({
			kind: "cash",
			evDiff: null,
		});
	});
});

describe("projectEntry: events without a T05 projection", () => {
	it("ignores chip, seat, memo, table and re-entry events", () => {
		const base = [
			ev("session_start", 0, { buyInAmount: 30_000 }),
			ev("session_end", 90, { cashOutAmount: 30_000 }),
		];
		const noisy = [
			...base,
			ev("chips_add_remove", 10, { amount: 10_000 }),
			ev("chips_add_remove", 20, { amount: -5000 }),
			ev("purchase_chips", 25, {
				sessionChipPurchaseId: "rebuy",
				name: "Rebuy",
				cost: 5000,
				chips: 10_000,
			}),
			ev("reentry", 26, { payments: [] }, { version: 2 }),
			ev("table_change", 30, { tableLabel: "T5" }, { version: 2 }),
			ev("player_join", 40, { isHero: true, seatPosition: 3 }),
			ev("player_leave", 50, { isHero: true }),
			ev("memo", 60, { text: "note" }),
		];
		expect(projectEntry(noisy, cash)).toEqual(projectEntry(base, cash));
	});
});

describe("projectEntry: update_stack", () => {
	it("takes total entries from the latest stack update that reports them", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0),
				ev("update_stack", 10, {
					stackAmount: 25_000,
					totalEntries: 120,
					chipPurchaseCounts: [
						{ name: "Rebuy", count: 1, chipsPerUnit: 10_000 },
					],
				}),
				ev(
					"update_stack",
					20,
					{ stackAmount: 31_000, totalEntries: 135, remainingPlayers: 90 },
					{ version: 2 }
				),
				ev("update_stack", 30, { stackAmount: 28_000 }),
			],
			tournament
		);
		expect(projection.detail).toEqual({
			kind: "tournament",
			placement: null,
			totalEntries: 135,
			beforeDeadline: null,
		});
	});
});

describe("projectEntry: day_end", () => {
	it("bags a tournament day and keeps the entry open", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0),
				ev(
					"day_end",
					300,
					{ endState: "bagged", stackAmount: 48_000 },
					{ version: 2 }
				),
			],
			tournament
		);
		expect(onlySession(projection)).toMatchObject({
			endedAt: at(300),
			status: "ended",
			endState: "bagged",
			endStack: 48_000,
		});
		expect(projection.status).toBe("open");
	});

	it("holds a cash stack and keeps the entry open", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, { buyInAmount: 30_000 }),
				ev(
					"day_end",
					120,
					{ endState: "held", stackAmount: 41_000 },
					{ version: 2 }
				),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			status: "ended",
			endState: "held",
			endStack: 41_000,
		});
		expect(projection.status).toBe("open");
	});
});

describe("projectEntry: session_end (cash)", () => {
	it("cashes out with the v1 cash-out as the end stack and settles the entry", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, { buyInAmount: 30_000 }),
				ev("session_end", 180, { cashOutAmount: 45_000 }),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			endedAt: at(180),
			status: "ended",
			endState: "cashed_out",
			endStack: 45_000,
		});
		expect(projection.status).toBe("settled");
		expect(projection.detail).toEqual({ kind: "cash", evDiff: 0 });
	});

	it("reads the end stack from v2 cash_out payments", () => {
		const projection = projectEntry(
			[
				ev(
					"session_start",
					0,
					{ payments: [{ assetId: "jpy", quantity: 30_000, role: "buy_in" }] },
					{ version: 2 }
				),
				ev(
					"session_end",
					180,
					{
						payments: [{ assetId: "jpy", quantity: 45_000, role: "cash_out" }],
					},
					{ version: 2 }
				),
			],
			cash
		);
		expect(onlySession(projection)).toMatchObject({
			endState: "cashed_out",
			endStack: 45_000,
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
					placement: 1,
					totalEntries: 80,
					prizeMoney: 300_000,
					bountyPrizes: 0,
				}),
			],
			tournament
		);
		expect(onlySession(projection)).toMatchObject({
			endedAt: at(400),
			status: "ended",
			endState: "finished",
			endStack: null,
		});
		expect(projection.status).toBe("settled");
		expect(projection.detail).toEqual({
			kind: "tournament",
			placement: 1,
			totalEntries: 80,
			beforeDeadline: null,
		});
	});

	it("busts any other placement", () => {
		const projection = projectEntry(
			[
				...started,
				ev("session_end", 400, {
					beforeDeadline: false,
					placement: 7,
					totalEntries: 80,
					prizeMoney: 20_000,
					bountyPrizes: 5000,
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
					prizeMoney: 0,
					bountyPrizes: 0,
				}),
			],
			tournament
		);
		expect(onlySession(projection)?.endState).toBe("busted");
		expect(projection.status).toBe("settled");
		expect(projection.detail).toEqual({
			kind: "tournament",
			placement: null,
			totalEntries: null,
			beforeDeadline: true,
		});
	});

	it("reads the result from a v2 payload with prize payments", () => {
		const projection = projectEntry(
			[
				...started,
				ev(
					"session_end",
					400,
					{
						beforeDeadline: false,
						placement: 3,
						totalEntries: 80,
						payments: [
							{ assetId: "ticket", quantity: 1, role: "prize" },
							{ assetId: "jpy", quantity: 5000, role: "bounty" },
						],
					},
					{ version: 2 }
				),
			],
			tournament
		);
		expect(onlySession(projection)?.endState).toBe("busted");
		expect(projection.detail).toEqual({
			kind: "tournament",
			placement: 3,
			totalEntries: 80,
			beforeDeadline: null,
		});
	});
});

describe("projectEntry: several play sessions (§13.3)", () => {
	const day2 = { playSessionId: "day-2" };
	const multiDay: ProjectorContext = {
		kind: "tournament",
		playSessions: [...twoDays].reverse(),
	};
	const dayOne = [
		ev("session_start", 0, { timerStartedAt: TIMER_STARTED_AT }),
		ev("update_stack", 100, { stackAmount: 50_000, totalEntries: 200 }),
		ev(
			"day_end",
			300,
			{ endState: "bagged", stackAmount: 61_000 },
			{ version: 2 }
		),
	];
	const dayTwoStart = ev(
		"session_start",
		1440,
		{ timerStartedAt: TIMER_STARTED_AT + 86_400, startLevel: 15 },
		{ ...day2, version: 2 }
	);

	it("keeps a bagged entry open while the next day plays", () => {
		const projection = projectEntry([...dayOne, dayTwoStart], multiDay);
		expect(projection.playSessions.map((session) => session.id)).toEqual([
			"day-1",
			"day-2",
		]);
		expect(projection.playSessions[0]).toMatchObject({
			status: "ended",
			endState: "bagged",
			endStack: 61_000,
			clockStartLevel: null,
		});
		expect(projection.playSessions[1]).toMatchObject({
			startedAt: at(1440),
			status: "active",
			clockStartedAt: new Date((TIMER_STARTED_AT + 86_400) * 1000),
			clockStartLevel: 15,
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
						placement: 4,
						totalEntries: 200,
						prizeMoney: 80_000,
						bountyPrizes: 0,
					},
					day2
				),
			],
			multiDay
		);
		expect(projection.status).toBe("settled");
		expect(projection.detail).toEqual({
			kind: "tournament",
			placement: 4,
			totalEntries: 200,
			beforeDeadline: null,
		});
	});

	it("reopens a busted tournament for a re-entry and drops the earlier result", () => {
		const firstBullet = [
			ev("session_start", 0),
			ev("session_end", 60, {
				beforeDeadline: false,
				placement: 150,
				totalEntries: 150,
				prizeMoney: 0,
				bountyPrizes: 0,
			}),
		];
		const reentered = projectEntry(
			[...firstBullet, ev("session_start", 70, {}, day2)],
			{ kind: "tournament", playSessions: twoDays }
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
						placement: 2,
						totalEntries: 180,
						prizeMoney: 120_000,
						bountyPrizes: 0,
					},
					day2
				),
			],
			{ kind: "tournament", playSessions: twoDays }
		);
		expect(finished.status).toBe("settled");
		expect(finished.detail).toMatchObject({ placement: 2, totalEntries: 180 });
	});

	it("sums EV over every play session of a cash entry that resumed after held", () => {
		const projection = projectEntry(
			[
				ev("session_start", 0, { buyInAmount: 30_000 }),
				ev("all_in", 10, { potSize: 1000, trials: 1, equity: 40, wins: 0 }),
				ev(
					"day_end",
					60,
					{ endState: "held", stackAmount: 35_000 },
					{ version: 2 }
				),
				ev("session_start", 120, {}, { ...day2, version: 2 }),
				ev(
					"all_in",
					130,
					{ potSize: 2000, trials: 2, equity: 25, wins: 1 },
					day2
				),
				ev("session_end", 200, { cashOutAmount: 20_000 }, day2),
			],
			{ kind: "cash", playSessions: twoDays }
		);
		expect(projection.playSessions.map((session) => session.endState)).toEqual([
			"held",
			"cashed_out",
		]);
		expect(projection.status).toBe("settled");
		expect(projection.detail).toEqual({ kind: "cash", evDiff: -100 });
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

interface LegacyFixture {
	events: ProjectorEvent[];
	kind: "cash" | "tournament";
	name: string;
}

const legacyFixtures: LegacyFixture[] = [
	{
		name: "completed cash session with breaks, chips and all-ins",
		kind: "cash",
		events: [
			ev("session_start", 0, { buyInAmount: 30_000 }),
			ev("all_in", 15, { potSize: 12_000, trials: 1, equity: 82, wins: 0 }),
			ev("session_pause", 40),
			ev("session_resume", 55),
			ev("chips_add_remove", 60, { amount: 10_000 }),
			ev("update_stack", 70, { stackAmount: 26_000 }),
			ev("all_in", 90, { potSize: 8000, trials: 4, equity: 30, wins: 2 }),
			ev("chips_add_remove", 120, { amount: -5000 }),
			ev("session_pause", 150),
			ev("session_resume", 162),
			ev("session_end", 240, { cashOutAmount: 52_000 }),
		],
	},
	{
		name: "cash session in progress",
		kind: "cash",
		events: [
			ev("session_start", 0, { buyInAmount: 20_000 }),
			ev("all_in", 15, { potSize: 6000, trials: 1, equity: 50, wins: 1 }),
			ev("session_pause", 40),
			ev("session_resume", 50),
		],
	},
	{
		name: "cash session paused in progress",
		kind: "cash",
		events: [
			ev("session_start", 0, { buyInAmount: 20_000 }),
			ev("session_pause", 40),
		],
	},
	{
		name: "completed tournament with rebuys and a cash",
		kind: "tournament",
		events: [
			ev("session_start", 0, { timerStartedAt: TIMER_STARTED_AT }),
			ev("purchase_chips", 30, {
				sessionChipPurchaseId: "rebuy",
				name: "Rebuy",
				cost: 5000,
				chips: 10_000,
			}),
			ev("update_stack", 60, {
				stackAmount: 42_000,
				remainingPlayers: 60,
				totalEntries: 118,
			}),
			ev("session_pause", 120),
			ev("session_resume", 135),
			ev("session_end", 360, {
				beforeDeadline: false,
				placement: 3,
				totalEntries: 120,
				prizeMoney: 150_000,
				bountyPrizes: 10_000,
			}),
		],
	},
	{
		name: "completed tournament win",
		kind: "tournament",
		events: [
			ev("session_start", 0, { timerStartedAt: null }),
			ev("session_end", 480, {
				beforeDeadline: false,
				placement: 1,
				totalEntries: 45,
				prizeMoney: 400_000,
				bountyPrizes: 0,
			}),
		],
	},
	{
		name: "tournament busted before the registration deadline",
		kind: "tournament",
		events: [
			ev("session_start", 0, {}),
			ev("update_stack", 30, { stackAmount: 0, totalEntries: 60 }),
			ev("session_end", 45, {
				beforeDeadline: true,
				prizeMoney: 0,
				bountyPrizes: 0,
			}),
		],
	},
	{
		name: "tournament in progress",
		kind: "tournament",
		events: [
			ev("session_start", 0, { timerStartedAt: TIMER_STARTED_AT }),
			ev("session_pause", 30),
			ev("session_resume", 40),
		],
	},
];

function replayLegacyFold({ kind, events }: LegacyFixture) {
	const legacyEvents = events.map((event) => ({
		eventType: event.type,
		occurredAt: event.occurredAt,
		payload: event.payload,
	}));
	const state = computeSessionStateFromEvents(legacyEvents);
	const completed = state.status === "completed";
	const session = {
		startedAt: state.startedAt,
		endedAt: completed ? state.endedAt : null,
		status: completed ? "ended" : state.status,
	};
	const status = completed ? "settled" : "open";

	if (kind === "cash") {
		const pl = computeCashGamePLFromEvents(legacyEvents);
		return {
			status,
			session: { ...session, endStack: completed ? pl.cashOut : null },
			breakMinutes: completed
				? computeBreakMinutesFromEvents(legacyEvents)
				: null,
			detail: {
				kind,
				evDiff:
					pl.evCashOut === null || pl.cashOut === null
						? null
						: Math.round(pl.evCashOut - pl.cashOut),
			},
		};
	}

	const pl = computeTournamentPLFromEvents(legacyEvents);
	return {
		status,
		session,
		breakMinutes: completed
			? computeBreakMinutesFromEvents(legacyEvents)
			: null,
		detail: completed
			? {
					kind,
					placement: pl.placement,
					totalEntries: pl.totalEntries,
					beforeDeadline: pl.beforeDeadline ? true : null,
				}
			: null,
	};
}

describe("characterization: v1 event logs project to what the legacy live-session-pl fold writes, so T07 dual writes and audit A-6 agree with the old columns until the T09 read switch", () => {
	it.each(legacyFixtures)("$name", (fixture) => {
		const legacy = replayLegacyFold(fixture);
		const projection = projectEntry(fixture.events, {
			kind: fixture.kind,
			playSessions: oneDay,
		});
		const session = onlySession(projection);

		expect(projection.status).toBe(legacy.status);
		expect(session).toMatchObject(legacy.session);
		if (legacy.breakMinutes !== null) {
			expect(session?.breakMinutes).toBe(legacy.breakMinutes);
		}
		if (legacy.detail !== null) {
			expect(projection.detail).toEqual(legacy.detail);
		}
	});
});
