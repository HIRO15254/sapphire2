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
		addonCost: null,
		beforeDeadline: null,
		bountyPrizes: null,
		buyIn: 10_000,
		cashOut: 15_000,
		currencyUnit: "JPY",
		endedAt: null,
		entryFee: null,
		evProfitLoss: null,
		placement: null,
		prizeMoney: null,
		profitLoss: 5000,
		rebuyCost: null,
		rebuyCount: null,
		ringGameBlind2: 500,
		ringGameName: "NL2k/5k",
		sessionDate: "2026-04-22T00:00:00Z",
		startedAt: null,
		storeName: "Downtown",
		totalEntries: null,
		tournamentBuyIn: null,
		tournamentName: null,
		type: "cash_game",
		...overrides,
	};
}

function tournamentSession(
	overrides: Partial<ShareableSession> = {}
): ShareableSession {
	return cashSession({
		type: "tournament",
		ringGameName: null,
		ringGameBlind2: null,
		tournamentName: "Weekly 50k GTD",
		tournamentBuyIn: 10_000,
		profitLoss: -10_000,
		...overrides,
	});
}

describe("createSessionShareText", () => {
	describe("cash game", () => {
		it("includes header, date, store, game name, and profit line", () => {
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
			const text = createSessionShareText(cashSession({ profitLoss: -3000 }));
			expect(text).toContain("📉 -3.0K JPY");
		});

		it("adds EV line when evProfitLoss is present", () => {
			const text = createSessionShareText(cashSession({ evProfitLoss: 1200 }));
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
			const text = createSessionShareText(
				tournamentSession({
					profitLoss: 20_000,
					prizeMoney: 30_000,
					evProfitLoss: 12_345, // should be ignored in tournament branch
				})
			);
			expect(text).toContain("(Prize: +30.0K JPY)");
			expect(text).not.toContain("EV:");
		});

		it("omits prize addendum when prizeMoney is 0", () => {
			const text = createSessionShareText(
				tournamentSession({ profitLoss: 100, prizeMoney: 0 })
			);
			expect(text).not.toContain("Prize");
		});
	});

	describe("formatters", () => {
		it("M tier triggers at >= 1M", () => {
			const text = createSessionShareText(
				cashSession({ profitLoss: 1_500_000 })
			);
			expect(text).toContain("📈 +1.5M JPY");
		});

		it("empty currency produces 'X k' then space then unit (empty)", () => {
			const text = createSessionShareText(
				cashSession({ currencyUnit: null, profitLoss: 500 })
			);
			expect(text).toMatch(COMPACT_500);
		});

		it("integer profitLoss under 1k is rounded to int string", () => {
			const text = createSessionShareText(cashSession({ profitLoss: 42 }));
			expect(text).toContain("📈 +42 JPY");
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
