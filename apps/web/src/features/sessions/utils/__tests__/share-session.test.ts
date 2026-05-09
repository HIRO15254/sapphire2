import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createSessionShareText,
	type ShareableSession,
	shareSession,
} from "@/features/sessions/utils/share-session";

const DURATION_3_5H = /\/ 3\.5h/;
const ANY_DURATION = /\d+\.\dh/;
const COMPACT_500 = /📈 \+500 \n/;

function cashSession(
	overrides: Partial<ShareableSession> = {}
): ShareableSession {
	return {
		kind: "cash_game",
		beforeDeadline: null,
		bountyPrizes: null,
		breakMinutes: null,
		cashBuyIn: 10_000,
		cashOut: 15_000,
		currencyUnit: "JPY",
		endedAt: null,
		evCashOut: null,
		placement: null,
		prizeMoney: null,
		ringGameName: "NL2k/5k",
		sessionDate: "2026-04-22T00:00:00Z",
		startedAt: null,
		storeName: "Downtown",
		totalEntries: null,
		tournamentBuyIn: null,
		tournamentEntryFee: null,
		tournamentName: null,
		...overrides,
	};
}

function tournamentSession(
	overrides: Partial<ShareableSession> = {}
): ShareableSession {
	return cashSession({
		kind: "tournament",
		ringGameName: null,
		tournamentName: "Weekly 50k GTD",
		tournamentBuyIn: 10_000,
		tournamentEntryFee: null,
		// cashOut = 0, cashBuyIn = 10000 → profitLoss for tournament uses tournament fields
		cashBuyIn: null,
		cashOut: null,
		prizeMoney: null,
		...overrides,
	});
}

describe("createSessionShareText", () => {
	describe("cash game", () => {
		it("includes header, date, store, game name, and profit line", () => {
			// cashOut (15000) - cashBuyIn (10000) = +5000
			const text = createSessionShareText(cashSession());
			expect(text).toContain("📊 Poker Session Result");
			expect(text).toContain("📅 ");
			expect(text).toContain("📍 Downtown");
			expect(text).toContain("💲 NL2k/5k");
			expect(text).toContain("📈 +5.0K JPY");
		});

		it("omits store line when storeName is null", () => {
			const text = createSessionShareText(cashSession({ storeName: null }));
			expect(text).not.toContain("📍");
		});

		it("uses 📉 and no '+' prefix for negative PL", () => {
			// cashOut (7000) - cashBuyIn (10000) = -3000
			const text = createSessionShareText(
				cashSession({ cashBuyIn: 10_000, cashOut: 7000 })
			);
			expect(text).toContain("📉 -3.0K JPY");
		});

		it("adds EV line when evCashOut is present", () => {
			// EV P&L = evCashOut (11200) - cashBuyIn (10000) = +1200
			const text = createSessionShareText(cashSession({ evCashOut: 11_200 }));
			expect(text).toContain("(EV: +1.2K JPY)");
		});

		it("adds duration when both startedAt and endedAt are set", () => {
			const text = createSessionShareText(
				cashSession({
					startedAt: "2026-04-22T12:00:00Z",
					endedAt: "2026-04-22T15:30:00Z",
				})
			);
			expect(text).toMatch(DURATION_3_5H);
		});

		it("omits duration when only one of startedAt/endedAt is set", () => {
			const text = createSessionShareText(
				cashSession({
					startedAt: "2026-04-22T12:00:00Z",
					endedAt: null,
				})
			);
			expect(text).not.toMatch(ANY_DURATION);
		});

		it("falls back to 'Cash Game' when ringGameName is null", () => {
			const text = createSessionShareText(cashSession({ ringGameName: null }));
			expect(text).toContain("💲 Cash Game");
		});

		it("shows zero PL when cashBuyIn and cashOut are both null", () => {
			const text = createSessionShareText(
				cashSession({ cashBuyIn: null, cashOut: null })
			);
			// 0 - 0 = 0 → "+0 JPY"
			expect(text).toContain("📈 +0 JPY");
		});
	});

	describe("tournament", () => {
		it("shows tournament icon and name", () => {
			const text = createSessionShareText(tournamentSession());
			expect(text).toContain("🏆 Weekly 50k GTD");
		});

		it("falls back to 'Tournament' name when null", () => {
			const text = createSessionShareText(
				tournamentSession({ tournamentName: null })
			);
			expect(text).toContain("🏆 Tournament");
		});

		it("emits '- / - entries' when beforeDeadline=true", () => {
			const text = createSessionShareText(
				tournamentSession({ beforeDeadline: true })
			);
			expect(text).toContain("🧾 - / - entries");
		});

		it("emits ordinal placement + entries when placement is set", () => {
			const text = createSessionShareText(
				tournamentSession({ placement: 3, totalEntries: 100 })
			);
			expect(text).toContain("🧾 3rd / 100 entries");
		});

		it("emits ordinal 'nd' at 2", () => {
			const text = createSessionShareText(
				tournamentSession({ placement: 2, totalEntries: 100 })
			);
			expect(text).toContain("🧾 2nd / 100 entries");
		});

		it("emits ordinal 'st' at 1", () => {
			const text = createSessionShareText(
				tournamentSession({ placement: 1, totalEntries: 50 })
			);
			expect(text).toContain("🧾 1st / 50 entries");
		});

		it("emits ordinal 'th' for teens", () => {
			const text = createSessionShareText(tournamentSession({ placement: 11 }));
			expect(text).toContain("🧾 11th");
		});

		it("shows placement without ' / entries' when totalEntries is null", () => {
			const text = createSessionShareText(
				tournamentSession({ placement: 5, totalEntries: null })
			);
			expect(text).toContain("🧾 5th");
			expect(text).not.toContain("entries");
		});

		it("prefers prizeMoney addendum over EV/duration (tournament branch)", () => {
			// prizeMoney (30000) - tournamentBuyIn (10000) = +20000
			const text = createSessionShareText(
				tournamentSession({
					prizeMoney: 30_000,
					evCashOut: 12_345, // should be ignored in tournament branch
				})
			);
			expect(text).toContain("(Prize: +30.0K JPY)");
			expect(text).not.toContain("EV:");
		});

		it("omits prize addendum when prizeMoney is 0", () => {
			// tournamentBuyIn=10000, prizeMoney=100 → P&L = 100-10000 = -9900
			const text = createSessionShareText(tournamentSession({ prizeMoney: 0 }));
			expect(text).not.toContain("Prize");
		});

		it("computes tournament profit loss from prizeMoney minus costs", () => {
			// prizeMoney (50000) - tournamentBuyIn (10000) - tournamentEntryFee (2000) = +38000
			const text = createSessionShareText(
				tournamentSession({
					prizeMoney: 50_000,
					tournamentBuyIn: 10_000,
					tournamentEntryFee: 2000,
				})
			);
			expect(text).toContain("📈 +38.0K JPY");
		});
	});

	describe("formatters", () => {
		it("M tier triggers at >= 1M", () => {
			// cashOut (1510000) - cashBuyIn (10000) = +1500000
			const text = createSessionShareText(
				cashSession({ cashBuyIn: 10_000, cashOut: 1_510_000 })
			);
			expect(text).toContain("📈 +1.5M JPY");
		});

		it("empty currency produces amount then space then empty unit", () => {
			// cashOut (10500) - cashBuyIn (10000) = +500
			const text = createSessionShareText(
				cashSession({ currencyUnit: null, cashBuyIn: 10_000, cashOut: 10_500 })
			);
			expect(text).toMatch(COMPACT_500);
		});

		it("integer PL under 1k is rounded to int string", () => {
			// cashOut (10042) - cashBuyIn (10000) = +42
			const text = createSessionShareText(
				cashSession({ cashBuyIn: 10_000, cashOut: 10_042 })
			);
			expect(text).toContain("📈 +42 JPY");
		});

		it("handles Date objects for sessionDate", () => {
			const text = createSessionShareText(
				cashSession({ sessionDate: new Date("2026-04-22T00:00:00Z") })
			);
			expect(text).toContain("📅 ");
		});

		it("handles Date objects for startedAt and endedAt", () => {
			const text = createSessionShareText(
				cashSession({
					startedAt: new Date("2026-04-22T12:00:00Z"),
					endedAt: new Date("2026-04-22T15:30:00Z"),
				})
			);
			expect(text).toMatch(DURATION_3_5H);
		});
	});
});

describe("shareSession", () => {
	const originalShare = navigator.share;
	const originalClipboard = navigator.clipboard;

	beforeEach(() => {
		Object.defineProperty(navigator, "share", {
			configurable: true,
			writable: true,
			value: undefined,
		});
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			writable: true,
			value: { writeText: vi.fn(async () => undefined) },
		});
	});

	afterEach(() => {
		Object.defineProperty(navigator, "share", {
			configurable: true,
			writable: true,
			value: originalShare,
		});
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			writable: true,
			value: originalClipboard,
		});
	});

	it("uses navigator.share when available", async () => {
		const shareSpy = vi.fn(async (_data: ShareData) => undefined);
		Object.defineProperty(navigator, "share", {
			configurable: true,
			writable: true,
			value: shareSpy,
		});
		await shareSession(cashSession());
		expect(shareSpy).toHaveBeenCalledTimes(1);
		const firstCall = shareSpy.mock.calls[0];
		expect(firstCall?.[0]).toMatchObject({
			title: "Poker Session Result",
			text: expect.stringContaining("📊"),
		});
	});

	it("falls back to clipboard when navigator.share is missing", async () => {
		await shareSession(cashSession());
		expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
	});
});
