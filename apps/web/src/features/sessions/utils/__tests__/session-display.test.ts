import { describe, expect, it } from "vitest";
import {
	buildCashRuleRows,
	buildCashStatRows,
	buildSessionMetaRows,
	buildTournamentRuleRows,
	buildTournamentStatRows,
	formatSessionDuration,
	formatSessionEvDisplay,
	formatSessionPlDisplay,
	formatTournamentResult,
	getSessionGameName,
	isLiveSession,
} from "@/features/sessions/utils/session-display";

describe("getSessionGameName", () => {
	it("returns the tournament rule name for a named tournament", () => {
		expect(
			getSessionGameName({
				type: "tournament",
				tournamentName: "Sunday Major",
				ringGameName: null,
			})
		).toBe("Sunday Major");
	});

	it("returns the ring game rule name for a named cash game", () => {
		expect(
			getSessionGameName({
				type: "cash_game",
				tournamentName: null,
				ringGameName: "1/2 NLH",
			})
		).toBe("1/2 NLH");
	});

	it("falls back to 'Tournament' when a tournament has no rule name", () => {
		expect(
			getSessionGameName({
				type: "tournament",
				tournamentName: null,
				ringGameName: null,
			})
		).toBe("Tournament");
	});

	it("falls back to 'Cash game' when a cash game has no rule name", () => {
		expect(
			getSessionGameName({
				type: "cash_game",
				tournamentName: null,
				ringGameName: null,
			})
		).toBe("Cash game");
	});

	it("ignores a ring game name on a tournament session", () => {
		expect(
			getSessionGameName({
				type: "tournament",
				tournamentName: null,
				ringGameName: "1/2 NLH",
			})
		).toBe("Tournament");
	});

	it("ignores a tournament name on a cash game session", () => {
		expect(
			getSessionGameName({
				type: "cash_game",
				tournamentName: "Sunday Major",
				ringGameName: null,
			})
		).toBe("Cash game");
	});
});

describe("isLiveSession", () => {
	it("is true when source is 'live'", () => {
		expect(isLiveSession({ source: "live" })).toBe(true);
	});

	it("is false when source is 'manual'", () => {
		expect(isLiveSession({ source: "manual" })).toBe(false);
	});

	it("is false for any other source value", () => {
		expect(isLiveSession({ source: "" })).toBe(false);
	});
});

describe("formatSessionDuration", () => {
	it("returns null when startedAt is missing", () => {
		expect(formatSessionDuration(null, "2026-01-01T12:00:00")).toBeNull();
	});

	it("returns null when endedAt is missing", () => {
		expect(formatSessionDuration("2026-01-01T10:00:00", null)).toBeNull();
	});

	it("returns null when both bounds are missing", () => {
		expect(formatSessionDuration(null, null)).toBeNull();
	});

	it("formats a 2-hour span as '2.0h'", () => {
		expect(
			formatSessionDuration("2026-01-01T10:00:00", "2026-01-01T12:00:00")
		).toBe("2.0h");
	});

	it("subtracts break minutes from the played duration", () => {
		expect(
			formatSessionDuration("2026-01-01T10:00:00", "2026-01-01T12:00:00", 30)
		).toBe("1.5h");
	});

	it("treats undefined break minutes as zero", () => {
		expect(
			formatSessionDuration("2026-01-01T10:00:00", "2026-01-01T11:00:00")
		).toBe("1.0h");
	});

	it("rounds to one decimal place", () => {
		expect(
			formatSessionDuration("2026-01-01T10:00:00", "2026-01-01T10:40:00")
		).toBe("0.7h");
	});

	it("clamps a negative raw span to '0.0h' (legacy day-crossing row, SA2-157)", () => {
		// endedAt before startedAt (a row saved before the day-crossing fix) must
		// never surface a negative "-20.0h" duration.
		expect(
			formatSessionDuration("2026-01-01T22:00:00", "2026-01-01T02:00:00")
		).toBe("0.0h");
	});

	it("clamps to '0.0h' when break minutes exceed the played span (SA2-157)", () => {
		expect(
			formatSessionDuration("2026-01-01T10:00:00", "2026-01-01T11:00:00", 120)
		).toBe("0.0h");
	});
});

describe("buildCashRuleRows", () => {
	const base = {
		cashAnte: null,
		cashAnteType: null,
		cashBlind1: 1,
		cashBlind3: null,
		cashTableSize: null,
		cashVariant: "NL Hold'em",
		ringGameBlind2: 2,
	};

	it("renders variant, blinds, and table size", () => {
		expect(buildCashRuleRows({ ...base, cashTableSize: 6 })).toEqual([
			{ label: "Variant", value: "NL Hold'em" },
			{ label: "Blinds", value: "1/2" },
			{ label: "Table", value: "6-max" },
		]);
	});

	it("appends a straddle to the blinds when present", () => {
		expect(
			buildCashRuleRows({ ...base, cashBlind3: 5 }).find(
				(r) => r.label === "Blinds"
			)
		).toEqual({ label: "Blinds", value: "1/2/5" });
	});

	it("appends the ante suffix to the blinds row", () => {
		expect(
			buildCashRuleRows({ ...base, cashAnte: 2, cashAnteType: "bb" }).find(
				(r) => r.label === "Blinds"
			)
		).toEqual({ label: "Blinds", value: "1/2 (BBA:2)" });
	});

	it("omits the blinds row when no blinds are recorded", () => {
		const rows = buildCashRuleRows({
			...base,
			cashBlind1: null,
			ringGameBlind2: null,
		});
		expect(rows.find((r) => r.label === "Blinds")).toBeUndefined();
	});

	it("omits the variant row when no variant is set", () => {
		expect(
			buildCashRuleRows({ ...base, cashVariant: null }).find(
				(r) => r.label === "Variant"
			)
		).toBeUndefined();
	});

	it("returns an empty array when no rule data is recorded", () => {
		expect(
			buildCashRuleRows({
				cashAnte: null,
				cashAnteType: null,
				cashBlind1: null,
				cashBlind3: null,
				cashTableSize: null,
				cashVariant: null,
				ringGameBlind2: null,
			})
		).toEqual([]);
	});
});

describe("buildCashStatRows", () => {
	it("includes buy-in and cash-out when both are present", () => {
		expect(buildCashStatRows({ buyIn: 10_000, cashOut: 13_500 })).toEqual([
			{ label: "Buy-in", value: "10k" },
			{ label: "Cash-out", value: "13.5k" },
		]);
	});

	it("omits buy-in when it is null", () => {
		const rows = buildCashStatRows({ buyIn: null, cashOut: 13_500 });
		expect(rows.find((r) => r.label === "Buy-in")).toBeUndefined();
	});

	it("omits cash-out when it is null", () => {
		const rows = buildCashStatRows({ buyIn: 10_000, cashOut: null });
		expect(rows.find((r) => r.label === "Cash-out")).toBeUndefined();
	});

	it("never includes EV rows (EV lives in the P&L hero card)", () => {
		const rows = buildCashStatRows({ buyIn: 10_000, cashOut: 13_500 });
		expect(rows.map((r) => r.label)).toEqual(["Buy-in", "Cash-out"]);
	});

	it("returns an empty array when every value is null", () => {
		expect(buildCashStatRows({ buyIn: null, cashOut: null })).toEqual([]);
	});
});

describe("buildTournamentRuleRows", () => {
	const base = {
		entryFee: 0,
		tournamentBuyIn: 5000,
		tournamentStartingStack: null,
		tournamentTableSize: null,
		tournamentVariant: null,
	};

	it("includes the buy-in when present", () => {
		expect(
			buildTournamentRuleRows(base).find((r) => r.label === "Buy-in")
		).toEqual({ label: "Buy-in", value: "5,000" });
	});

	it("drops a zero entry fee but includes a positive one", () => {
		expect(
			buildTournamentRuleRows(base).find((r) => r.label === "Entry fee")
		).toBeUndefined();
		expect(
			buildTournamentRuleRows({ ...base, entryFee: 500 }).find(
				(r) => r.label === "Entry fee"
			)
		).toEqual({ label: "Entry fee", value: "500" });
	});

	it("renders variant, starting stack, and table size when present", () => {
		expect(
			buildTournamentRuleRows({
				...base,
				tournamentVariant: "NL Hold'em",
				tournamentStartingStack: 20_000,
				tournamentTableSize: 9,
			})
		).toEqual([
			{ label: "Variant", value: "NL Hold'em" },
			{ label: "Buy-in", value: "5,000" },
			{ label: "Starting stack", value: "20k" },
			{ label: "Table", value: "9-max" },
		]);
	});

	it("omits the buy-in when null", () => {
		expect(
			buildTournamentRuleRows({ ...base, tournamentBuyIn: null }).find(
				(r) => r.label === "Buy-in"
			)
		).toBeUndefined();
	});
});

describe("buildTournamentStatRows", () => {
	const base = {
		bountyPrizes: 0,
		chipPurchases: [] as Array<{
			cost: number;
			count: number;
			id: string;
			name: string;
		}>,
		placement: null,
		prizeMoney: 0,
		totalEntries: null,
	};

	it("returns an empty array when there is no result data", () => {
		expect(buildTournamentStatRows(base)).toEqual([]);
	});

	it("never includes buy-in or entry fee (those are rule data)", () => {
		const rows = buildTournamentStatRows({ ...base, prizeMoney: 20_000 });
		expect(rows.find((r) => r.label === "Buy-in")).toBeUndefined();
		expect(rows.find((r) => r.label === "Entry fee")).toBeUndefined();
	});

	it("drops zero-valued prize and bounty", () => {
		const rows = buildTournamentStatRows(base);
		expect(rows.find((r) => r.label === "Prize")).toBeUndefined();
		expect(rows.find((r) => r.label === "Bounty")).toBeUndefined();
	});

	it("includes positive prize and bounty", () => {
		const rows = buildTournamentStatRows({
			...base,
			prizeMoney: 20_000,
			bountyPrizes: 1500,
		});
		expect(rows.find((r) => r.label === "Prize")).toEqual({
			label: "Prize",
			value: "20k",
		});
		expect(rows.find((r) => r.label === "Bounty")).toEqual({
			label: "Bounty",
			value: "1,500",
		});
	});

	it("renders each purchased chip-purchase row as count × cost", () => {
		const rows = buildTournamentStatRows({
			...base,
			chipPurchases: [
				{ id: "cp1", name: "Re-entry", cost: 5000, count: 2 },
				{ id: "cp2", name: "Add-on", cost: 1000, count: 0 },
			],
		});
		expect(rows.find((r) => r.label === "Re-entry")).toEqual({
			label: "Re-entry",
			value: "2 × 5,000",
		});
		expect(rows.find((r) => r.label === "Add-on")).toBeUndefined();
	});

	it("falls back to 'Chip purchase' for an unnamed purchase", () => {
		const rows = buildTournamentStatRows({
			...base,
			chipPurchases: [{ id: "cp1", name: "", cost: 5000, count: 1 }],
		});
		expect(rows.find((r) => r.label === "Chip purchase")).toEqual({
			label: "Chip purchase",
			value: "1 × 5,000",
		});
	});

	it("shows placement without total entries as a bare number", () => {
		const rows = buildTournamentStatRows({ ...base, placement: 3 });
		expect(rows.find((r) => r.label === "Placement")).toEqual({
			label: "Placement",
			value: "3",
		});
	});

	it("shows placement over total entries when both are present", () => {
		const rows = buildTournamentStatRows({
			...base,
			placement: 3,
			totalEntries: 120,
		});
		expect(rows.find((r) => r.label === "Placement")).toEqual({
			label: "Placement",
			value: "3 / 120",
		});
	});

	it("omits placement when null", () => {
		expect(
			buildTournamentStatRows(base).find((r) => r.label === "Placement")
		).toBeUndefined();
	});
});

describe("buildSessionMetaRows", () => {
	const base = {
		breakMinutes: null,
		currencyName: null,
		endedAt: null,
		roomName: null,
		sessionDate: "2026-01-15",
		startedAt: null,
	};

	it("always includes the formatted date first", () => {
		const rows = buildSessionMetaRows(base);
		expect(rows[0]).toEqual({ label: "Date", value: "2026/01/15" });
	});

	it("omits room, currency, and duration when absent", () => {
		expect(buildSessionMetaRows(base)).toEqual([
			{ label: "Date", value: "2026/01/15" },
		]);
	});

	it("includes the room when set", () => {
		expect(
			buildSessionMetaRows({ ...base, roomName: "Aria" }).find(
				(r) => r.label === "Room"
			)
		).toEqual({ label: "Room", value: "Aria" });
	});

	it("includes the currency when set", () => {
		expect(
			buildSessionMetaRows({ ...base, currencyName: "USD" }).find(
				(r) => r.label === "Currency"
			)
		).toEqual({ label: "Currency", value: "USD" });
	});

	it("includes the played duration when both timestamps are present", () => {
		expect(
			buildSessionMetaRows({
				...base,
				startedAt: "2026-01-15T10:00:00",
				endedAt: "2026-01-15T13:00:00",
				breakMinutes: 30,
			}).find((r) => r.label === "Duration")
		).toEqual({ label: "Duration", value: "2.5h" });
	});

	it("omits duration when only one timestamp is present", () => {
		expect(
			buildSessionMetaRows({ ...base, startedAt: "2026-01-15T10:00:00" }).find(
				(r) => r.label === "Duration"
			)
		).toBeUndefined();
	});
});

describe("formatSessionPlDisplay", () => {
	const cash = {
		type: "cash_game",
		currencyUnit: "$",
		profitLoss: 1200,
		ringGameBlind2: 200,
		tournamentBuyIn: null,
		entryFee: null,
		chipPurchaseCost: 0,
	};
	const tournament = {
		type: "tournament",
		currencyUnit: "$",
		profitLoss: 10_000,
		ringGameBlind2: null,
		tournamentBuyIn: 5000,
		entryFee: 0,
		chipPurchaseCost: 0,
	};

	it("shows the currency P&L when the toggle is off", () => {
		expect(formatSessionPlDisplay(cash, false)).toBe("+1,200 $");
	});

	it("converts cash-game P&L to big blinds when the toggle is on", () => {
		// 1200 / 200 = 6.0 BB
		expect(formatSessionPlDisplay(cash, true)).toBe("+6.0 BB");
	});

	it("renders a negative BB value with a minus sign", () => {
		expect(formatSessionPlDisplay({ ...cash, profitLoss: -400 }, true)).toBe(
			"-2.0 BB"
		);
	});

	it("falls back to currency for a cash game with no big blind", () => {
		expect(
			formatSessionPlDisplay({ ...cash, ringGameBlind2: null }, true)
		).toBe("+1,200 $");
	});

	it("falls back to currency for a cash game with a zero big blind", () => {
		expect(formatSessionPlDisplay({ ...cash, ringGameBlind2: 0 }, true)).toBe(
			"+1,200 $"
		);
	});

	it("converts tournament P&L to buy-ins with two decimals when the toggle is on", () => {
		// 10000 / 5000 = 2.00 BI
		expect(formatSessionPlDisplay(tournament, true)).toBe("+2.00 BI");
	});

	it("includes entry fee and chip purchases in the tournament BI base", () => {
		// 10000 / (5000 + 1000 + 4000) = 1.00 BI
		expect(
			formatSessionPlDisplay(
				{ ...tournament, entryFee: 1000, chipPurchaseCost: 4000 },
				true
			)
		).toBe("+1.00 BI");
	});

	it("falls back to currency for a tournament with zero total cost", () => {
		expect(
			formatSessionPlDisplay(
				{ ...tournament, tournamentBuyIn: 0, entryFee: 0, chipPurchaseCost: 0 },
				true
			)
		).toBe("+10k $");
	});

	it("treats a null P&L as zero", () => {
		expect(formatSessionPlDisplay({ ...cash, profitLoss: null }, true)).toBe(
			"+0.0 BB"
		);
	});
});

describe("formatTournamentResult", () => {
	const base = { type: "tournament", placement: 3, totalEntries: 120 };

	it("returns placement over total entries when both are present", () => {
		expect(formatTournamentResult(base)).toBe("3 / 120");
	});

	it("returns a bare placement when total entries is null", () => {
		expect(formatTournamentResult({ ...base, totalEntries: null })).toBe("3");
	});

	it("returns null when placement is null", () => {
		expect(formatTournamentResult({ ...base, placement: null })).toBeNull();
	});

	it("returns null for a cash game even with a placement value", () => {
		expect(formatTournamentResult({ ...base, type: "cash_game" })).toBeNull();
	});

	it("renders a first-place finish", () => {
		expect(formatTournamentResult({ ...base, placement: 1 })).toBe("1 / 120");
	});
});

describe("formatSessionEvDisplay", () => {
	const cash = {
		type: "cash_game",
		currencyUnit: "$",
		profitLoss: 1200,
		evProfitLoss: 800,
		ringGameBlind2: 200,
		tournamentBuyIn: null,
		entryFee: null,
		chipPurchaseCost: 0,
	};

	it("returns null for a tournament session", () => {
		expect(
			formatSessionEvDisplay({ ...cash, type: "tournament" }, false)
		).toBeNull();
	});

	it("returns null when no EV P&L was recorded", () => {
		expect(
			formatSessionEvDisplay({ ...cash, evProfitLoss: null }, false)
		).toBeNull();
	});

	it("shows the currency EV P&L when the toggle is off", () => {
		expect(formatSessionEvDisplay(cash, false)).toBe("+800 $");
	});

	it("converts EV P&L to big blinds when the toggle is on", () => {
		// 800 / 200 = 4.0 BB
		expect(formatSessionEvDisplay(cash, true)).toBe("+4.0 BB");
	});

	it("renders a negative EV with a minus sign", () => {
		expect(formatSessionEvDisplay({ ...cash, evProfitLoss: -400 }, false)).toBe(
			"-400 $"
		);
	});

	it("falls back to currency when the big blind is unavailable", () => {
		expect(
			formatSessionEvDisplay({ ...cash, ringGameBlind2: null }, true)
		).toBe("+800 $");
	});

	it("rounds a fractional EV to whole units to match the P&L precision", () => {
		expect(
			formatSessionEvDisplay({ ...cash, evProfitLoss: 812.7 }, false)
		).toBe("+813 $");
	});

	it("rounds a fractional negative EV toward the nearest integer", () => {
		expect(
			formatSessionEvDisplay({ ...cash, evProfitLoss: -812.7 }, false)
		).toBe("-813 $");
	});

	it("rounds the EV before the big-blind conversion", () => {
		// round(812.7) = 813 → 813 / 200 = 4.065 → "4.1 BB"
		expect(formatSessionEvDisplay({ ...cash, evProfitLoss: 812.7 }, true)).toBe(
			"+4.1 BB"
		);
	});

	it("keeps EV aligned with the P&L in the compact-thousands tier", () => {
		// round(13,480.6) = 13,481 → 13.481k → "13.5k"
		expect(
			formatSessionEvDisplay({ ...cash, evProfitLoss: 13_480.6 }, false)
		).toBe("+13.5k $");
	});
});

describe("buildCashRuleRows — mix games", () => {
	const base = {
		cashAnte: null,
		cashAnteType: null,
		cashBlind1: null,
		cashBlind3: null,
		cashTableSize: null,
		cashVariant: "mix",
		ringGameBlind2: null,
	};
	const mixGames = [
		{
			name: "Limit",
			variants: ["lhe", "o8"],
			blind1: 400,
			blind2: 800,
			blind3: null,
			ante: null,
			anteType: null,
		},
		{
			name: null,
			variants: ["NL Hold'em", "Pot Limit Omaha"],
			blind1: 100,
			blind2: 200,
			blind3: null,
			ante: null,
			anteType: null,
		},
	];

	it("renders one row per game group after the variant row", () => {
		expect(buildCashRuleRows({ ...base, cashMixGames: mixGames })).toEqual([
			{ label: "Variant", value: "Mixed Game" },
			{ label: "Limit", value: "400/800" },
			{ label: "NL Hold'em+Pot Limit Omaha", value: "100/200" },
		]);
	});

	it("suppresses the flat blinds row for a mix session", () => {
		const rows = buildCashRuleRows({
			...base,
			cashBlind1: 1,
			ringGameBlind2: 2,
			cashMixGames: mixGames,
		});
		expect(rows.find((r) => r.label === "Blinds")).toBeUndefined();
	});

	it("keeps the flat blinds row when mixGames is empty", () => {
		const rows = buildCashRuleRows({
			...base,
			cashVariant: "nlh",
			cashBlind1: 1,
			ringGameBlind2: 2,
			cashMixGames: [],
		});
		expect(rows.find((r) => r.label === "Blinds")).toEqual({
			label: "Blinds",
			value: "1/2",
		});
	});
});
