import { room } from "@sapphire2/db/schema/room";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "../index";
import {
	computeCashGamePL,
	computeTournamentPL,
	fetchProfitLossSeries,
	getSessionChipPurchaseMap,
	sumChipPurchaseCost,
} from "./session";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

// ---------------------------------------------------------------------------
// Shared filter input
// ---------------------------------------------------------------------------

/**
 * Shared filter shape accepted by every stats procedure. Dates are unix
 * SECONDS (converted to ms when querying). `normalized` defaults to false; the
 * currency-scope guard (runtime, not schema) enforces that a currency is set
 * unless the caller has opted into normalized values.
 */
export const statsFilterShape = {
	currencyId: z.string().optional(),
	type: z.enum(["cash_game", "tournament"]).optional(),
	roomId: z.string().optional(),
	dateFrom: z.number().optional(),
	dateTo: z.number().optional(),
	normalized: z.boolean().default(false),
};

export const statsFilterSchema = z.object(statsFilterShape);

export const breakdownGroupByEnum = z.enum([
	"room",
	"stakes",
	"type",
	"dayOfWeek",
	"hour",
	"month",
	"year",
]);

export type BreakdownGroupBy = z.infer<typeof breakdownGroupByEnum>;

export const breakdownFilterSchema = statsFilterSchema.extend({
	groupBy: breakdownGroupByEnum,
});

type StatsFilters = z.infer<typeof statsFilterSchema>;

// ---------------------------------------------------------------------------
// Currency-scope guard
// ---------------------------------------------------------------------------

/**
 * Comparing raw currency amounts across different currencies is meaningless, so
 * every stats query must either pin a single currency or opt into normalized
 * (bb / buy-in) values. Throws BAD_REQUEST when neither is true.
 */
export function assertCurrencyScope(filters: {
	currencyId?: string;
	normalized?: boolean;
}): void {
	const hasCurrency = !!filters.currencyId;
	if (!hasCurrency && filters.normalized !== true) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "currencyId is required unless normalized is enabled",
		});
	}
}

// ---------------------------------------------------------------------------
// Internal row type + fetch
// ---------------------------------------------------------------------------

export interface StatsSessionRow {
	bigBlind: number | null; // cash blind2
	blind1: number | null;
	blind2: number | null;
	bountyPrizes: number | null;
	buyInTotal: number | null; // tournament total invested or null if 0
	evDiff: number | null; // cash only: evProfitLoss - profitLoss
	evProfitLoss: number | null; // cash only
	id: string;
	placement: number | null;
	playMinutes: number | null;
	prizeMoney: number | null; // tournament prizeMoney only (NOT incl bounty)
	profitLoss: number; // currency units
	roomId: string | null;
	roomName: string | null;
	sessionDate: number; // unix seconds
	totalEntries: number | null;
	type: "cash_game" | "tournament";
}

interface RawStatsRow {
	blind1: number | null;
	blind2: number | null;
	bountyPrizes: number | null;
	breakMinutes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	endedAt: Date | null;
	entryFee: number | null;
	evCashOut: number | null;
	id: string;
	placement: number | null;
	prizeMoney: number | null;
	roomId: string | null;
	roomName: string | null;
	sessionDate: Date;
	startedAt: Date | null;
	totalEntries: number | null;
	tournamentBuyIn: number | null;
	type: string;
}

/** Same play-minutes math as session.ts's computePlayMinutes. */
function computeRowPlayMinutes(r: RawStatsRow): number | null {
	if (!(r.startedAt && r.endedAt)) {
		return null;
	}
	const elapsed = Math.max(
		0,
		(r.endedAt.getTime() - r.startedAt.getTime()) / 60_000
	);
	return Math.max(0, elapsed - (r.breakMinutes ?? 0));
}

function mapStatsRow(
	r: RawStatsRow,
	chipPurchaseCost: number
): StatsSessionRow {
	const sessionDate = Math.floor(r.sessionDate.getTime() / 1000);
	const playMinutes = computeRowPlayMinutes(r);
	const base = {
		id: r.id,
		sessionDate,
		playMinutes,
		placement: r.placement,
		totalEntries: r.totalEntries,
		prizeMoney: r.prizeMoney,
		bountyPrizes: r.bountyPrizes,
		roomId: r.roomId,
		roomName: r.roomName,
		blind1: r.blind1,
		blind2: r.blind2,
	};

	if (r.type === "cash_game") {
		const profitLoss =
			r.buyIn === null || r.cashOut === null
				? 0
				: computeCashGamePL(r.buyIn, r.cashOut);
		const evProfitLoss =
			r.evCashOut === null || r.buyIn === null
				? null
				: computeCashGamePL(r.buyIn, r.evCashOut);
		const evDiff = evProfitLoss === null ? null : evProfitLoss - profitLoss;
		return {
			...base,
			type: "cash_game",
			profitLoss,
			evProfitLoss,
			evDiff,
			bigBlind: r.blind2,
			buyInTotal: null,
		};
	}

	const profitLoss = computeTournamentPL(
		r.tournamentBuyIn,
		r.entryFee,
		chipPurchaseCost,
		r.prizeMoney,
		r.bountyPrizes
	);
	const invested =
		(r.tournamentBuyIn ?? 0) + (r.entryFee ?? 0) + chipPurchaseCost;
	return {
		...base,
		type: "tournament",
		profitLoss,
		evProfitLoss: null,
		evDiff: null,
		bigBlind: null,
		buyInTotal: invested === 0 ? null : invested,
	};
}

export async function fetchStatsRows(
	db: DbInstance,
	userId: string,
	filters: StatsFilters
): Promise<StatsSessionRow[]> {
	const conditions = [eq(gameSession.userId, userId)];
	if (filters.type) {
		conditions.push(eq(gameSession.kind, filters.type));
	}
	if (filters.roomId) {
		conditions.push(eq(gameSession.roomId, filters.roomId));
	}
	if (filters.currencyId) {
		conditions.push(eq(gameSession.currencyId, filters.currencyId));
	}
	if (filters.dateFrom !== undefined) {
		conditions.push(
			gte(gameSession.sessionDate, new Date(filters.dateFrom * 1000))
		);
	}
	if (filters.dateTo !== undefined) {
		conditions.push(
			lte(gameSession.sessionDate, new Date(filters.dateTo * 1000))
		);
	}

	const rows: RawStatsRow[] = await db
		.select({
			id: gameSession.id,
			type: gameSession.kind,
			sessionDate: gameSession.sessionDate,
			startedAt: gameSession.startedAt,
			endedAt: gameSession.endedAt,
			breakMinutes: gameSession.breakMinutes,
			buyIn: sessionCashDetail.buyIn,
			cashOut: sessionCashDetail.cashOut,
			evCashOut: sessionCashDetail.evCashOut,
			blind1: sessionCashDetail.blind1,
			blind2: sessionCashDetail.blind2,
			tournamentBuyIn: sessionTournamentDetail.tournamentBuyIn,
			entryFee: sessionTournamentDetail.entryFee,
			placement: sessionTournamentDetail.placement,
			totalEntries: sessionTournamentDetail.totalEntries,
			prizeMoney: sessionTournamentDetail.prizeMoney,
			bountyPrizes: sessionTournamentDetail.bountyPrizes,
			roomId: gameSession.roomId,
			roomName: room.name,
		})
		.from(gameSession)
		.leftJoin(
			sessionCashDetail,
			eq(sessionCashDetail.sessionId, gameSession.id)
		)
		.leftJoin(
			sessionTournamentDetail,
			eq(sessionTournamentDetail.sessionId, gameSession.id)
		)
		.leftJoin(room, eq(room.id, gameSession.roomId))
		.where(and(...conditions));

	const chipPurchaseMap = await getSessionChipPurchaseMap(
		db,
		rows.map((r) => r.id)
	);

	return rows.map((r) =>
		mapStatsRow(r, sumChipPurchaseCost(chipPurchaseMap.get(r.id) ?? []))
	);
}

// ---------------------------------------------------------------------------
// Pure value helpers
// ---------------------------------------------------------------------------

/**
 * Per-session normalized value: cash → bb units (PL / bigBlind), tournament →
 * buy-ins (PL / buyInTotal). Null when the denominator is missing or zero so
 * non-normalizable sessions are excluded from normalized aggregates.
 */
export function normalizedSessionValue(row: StatsSessionRow): number | null {
	if (row.type === "cash_game") {
		return row.bigBlind && row.bigBlind > 0
			? row.profitLoss / row.bigBlind
			: null;
	}
	return row.buyInTotal && row.buyInTotal > 0
		? row.profitLoss / row.buyInTotal
		: null;
}

export function sessionDisplayValue(
	row: StatsSessionRow,
	normalized: boolean
): number | null {
	return normalized ? normalizedSessionValue(row) : row.profitLoss;
}

export function stakesLabel(row: StatsSessionRow): string {
	return `${row.blind1 ?? 0}/${row.blind2 ?? 0}`;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface StatsSummary {
	avgPlacement: number | null;
	avgProfitLoss: number | null;
	bbPerHour: number | null;
	// Cash sessions normalized to big blinds (bb). Null when no normalizable
	// cash sessions. Never combined with the tournament (bi) figure — the two
	// units live on different scales.
	cashNormalizedProfitLoss: number | null;
	hourlyRate: number | null;
	itmRate: number | null;
	roi: number | null;
	totalEvDiff: number | null;
	totalEvProfitLoss: number | null;
	totalPlayMinutes: number;
	totalPrizeMoney: number | null;
	totalProfitLoss: number;
	totalSessions: number;
	// Tournament sessions normalized to buy-ins (bi). Null when none.
	tournamentNormalizedProfitLoss: number | null;
	winRate: number;
}

const EMPTY_SUMMARY: StatsSummary = {
	totalSessions: 0,
	totalProfitLoss: 0,
	cashNormalizedProfitLoss: null,
	tournamentNormalizedProfitLoss: null,
	totalEvProfitLoss: null,
	totalEvDiff: null,
	winRate: 0,
	avgProfitLoss: null,
	totalPlayMinutes: 0,
	hourlyRate: null,
	bbPerHour: null,
	roi: null,
	itmRate: null,
	avgPlacement: null,
	totalPrizeMoney: null,
};

interface SummaryAccumulator {
	cashBbCount: number;
	cashBbSum: number;
	cashPL: number;
	cashPlayMinutes: number;
	evCount: number;
	evDiffSum: number;
	evSum: number;
	itmCount: number;
	placementCount: number;
	placementSum: number;
	totalPlayMinutes: number;
	totalProfitLoss: number;
	tournamentBiCount: number;
	tournamentBiSum: number;
	tournamentCount: number;
	tournamentInvested: number;
	tournamentPrize: number;
	tournamentPrizeMoneyAndBounty: number;
	winCount: number;
}

function accumulateCash(row: StatsSessionRow, acc: SummaryAccumulator): void {
	acc.cashPL += row.profitLoss;
	if (row.playMinutes !== null) {
		acc.cashPlayMinutes += row.playMinutes;
	}
	if (row.evProfitLoss !== null) {
		acc.evSum += row.evProfitLoss;
		acc.evCount += 1;
	}
	if (row.evDiff !== null) {
		acc.evDiffSum += row.evDiff;
	}
	const bb = normalizedSessionValue(row);
	if (bb !== null) {
		acc.cashBbSum += bb;
		acc.cashBbCount += 1;
	}
}

function accumulateTournament(
	row: StatsSessionRow,
	acc: SummaryAccumulator
): void {
	acc.tournamentCount += 1;
	acc.tournamentInvested += row.buyInTotal ?? 0;
	const prize = (row.prizeMoney ?? 0) + (row.bountyPrizes ?? 0);
	acc.tournamentPrize += prize;
	acc.tournamentPrizeMoneyAndBounty += prize;
	if (prize > 0) {
		acc.itmCount += 1;
	}
	if (row.placement !== null) {
		acc.placementSum += row.placement;
		acc.placementCount += 1;
	}
	const bi = normalizedSessionValue(row);
	if (bi !== null) {
		acc.tournamentBiSum += bi;
		acc.tournamentBiCount += 1;
	}
}

export function summarizeStats(rows: StatsSessionRow[]): StatsSummary {
	if (rows.length === 0) {
		return { ...EMPTY_SUMMARY };
	}

	const acc: SummaryAccumulator = {
		totalProfitLoss: 0,
		winCount: 0,
		totalPlayMinutes: 0,
		evSum: 0,
		evDiffSum: 0,
		evCount: 0,
		cashPL: 0,
		cashPlayMinutes: 0,
		cashBbSum: 0,
		cashBbCount: 0,
		tournamentBiSum: 0,
		tournamentBiCount: 0,
		tournamentCount: 0,
		tournamentInvested: 0,
		tournamentPrize: 0,
		itmCount: 0,
		placementSum: 0,
		placementCount: 0,
		tournamentPrizeMoneyAndBounty: 0,
	};

	for (const row of rows) {
		acc.totalProfitLoss += row.profitLoss;
		if (row.profitLoss > 0) {
			acc.winCount += 1;
		}
		acc.totalPlayMinutes += row.playMinutes ?? 0;
		if (row.type === "cash_game") {
			accumulateCash(row, acc);
		} else {
			accumulateTournament(row, acc);
		}
	}

	const totalSessions = rows.length;
	// We do not track hand counts, so there is no bb/100 metric — `bbPerHour`
	// (sum of bb won / cash play hours) is provided as the rate proxy instead.
	const cashHours = acc.cashPlayMinutes / 60;

	return {
		totalSessions,
		totalProfitLoss: acc.totalProfitLoss,
		cashNormalizedProfitLoss: acc.cashBbCount > 0 ? acc.cashBbSum : null,
		tournamentNormalizedProfitLoss:
			acc.tournamentBiCount > 0 ? acc.tournamentBiSum : null,
		totalEvProfitLoss: acc.evCount > 0 ? acc.evSum : null,
		totalEvDiff: acc.evCount > 0 ? acc.evDiffSum : null,
		winRate: (acc.winCount / totalSessions) * 100,
		avgProfitLoss: acc.totalProfitLoss / totalSessions,
		totalPlayMinutes: acc.totalPlayMinutes,
		hourlyRate: cashHours > 0 ? acc.cashPL / cashHours : null,
		bbPerHour:
			cashHours > 0 && acc.cashBbCount > 0 ? acc.cashBbSum / cashHours : null,
		roi:
			acc.tournamentInvested > 0
				? ((acc.tournamentPrize - acc.tournamentInvested) /
						acc.tournamentInvested) *
					100
				: null,
		itmRate:
			acc.tournamentCount > 0
				? (acc.itmCount / acc.tournamentCount) * 100
				: null,
		avgPlacement:
			acc.placementCount > 0 ? acc.placementSum / acc.placementCount : null,
		totalPrizeMoney:
			acc.tournamentCount > 0 ? acc.tournamentPrizeMoneyAndBounty : null,
	};
}

// ---------------------------------------------------------------------------
// Breakdown
// ---------------------------------------------------------------------------

export interface BreakdownRow {
	// Cash sessions in this group normalized to bb (null when none). Kept apart
	// from the tournament (bi) figure — the two units must never be summed.
	cashNormalizedProfitLoss: number | null;
	key: string;
	label: string;
	playMinutes: number;
	/** Currency profit/loss for the group (used when normalization is off). */
	profitLoss: number;
	sessions: number;
	tournamentNormalizedProfitLoss: number | null;
	winRate: number;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const TYPE_LABELS: Record<StatsSessionRow["type"], string> = {
	cash_game: "Cash game",
	tournament: "Tournament",
};

/**
 * Maps a row to its grouping key + label for the given dimension. Returns null
 * to EXCLUDE the row from the grouping (e.g. tournaments have no stakes).
 * dayOfWeek / hour / month / year buckets use UTC consistently.
 */
export function breakdownKeyLabel(
	row: StatsSessionRow,
	groupBy: BreakdownGroupBy
): { key: string; label: string } | null {
	if (groupBy === "room") {
		return { key: row.roomId ?? "none", label: row.roomName ?? "No room" };
	}
	if (groupBy === "type") {
		return { key: row.type, label: TYPE_LABELS[row.type] };
	}
	if (groupBy === "stakes") {
		if (row.type !== "cash_game") {
			return null;
		}
		const label = stakesLabel(row);
		return { key: label, label };
	}

	const date = new Date(row.sessionDate * 1000);
	if (groupBy === "dayOfWeek") {
		const day = date.getUTCDay();
		return { key: String(day), label: DAY_LABELS[day] ?? String(day) };
	}
	if (groupBy === "hour") {
		const hour = date.getUTCHours();
		return { key: String(hour), label: `${hour}:00` };
	}
	if (groupBy === "month") {
		const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
		return { key, label: key };
	}
	// year
	const key = String(date.getUTCFullYear());
	return { key, label: key };
}

interface BreakdownAccumulator {
	cashNormCount: number;
	cashNormSum: number;
	key: string;
	label: string;
	playMinutes: number;
	profitLoss: number;
	sessions: number;
	tournamentNormCount: number;
	tournamentNormSum: number;
	winCount: number;
}

const CHRONOLOGICAL_DIMS: ReadonlySet<BreakdownGroupBy> = new Set([
	"dayOfWeek",
	"hour",
	"month",
	"year",
]);

function sortBreakdownRows(
	rows: BreakdownRow[],
	groupBy: BreakdownGroupBy
): BreakdownRow[] {
	if (CHRONOLOGICAL_DIMS.has(groupBy)) {
		// dayOfWeek / hour / year are numeric keys; month is "YYYY-MM" lexical.
		const numeric = groupBy !== "month";
		return [...rows].sort((a, b) => {
			if (numeric) {
				return Number(a.key) - Number(b.key);
			}
			return a.key.localeCompare(b.key);
		});
	}
	// room / stakes / type: sessions desc, then profitLoss desc, then label asc.
	return [...rows].sort((a, b) => {
		if (b.sessions !== a.sessions) {
			return b.sessions - a.sessions;
		}
		if (b.profitLoss !== a.profitLoss) {
			return b.profitLoss - a.profitLoss;
		}
		return a.label.localeCompare(b.label);
	});
}

function accumulateBreakdownRow(
	group: BreakdownAccumulator,
	row: StatsSessionRow
): void {
	group.sessions += 1;
	// Currency profit/loss is always tracked; the normalized (bb / bi) sums are
	// kept per game type so cash and tournament are never combined.
	group.profitLoss += row.profitLoss;
	const norm = normalizedSessionValue(row);
	if (norm !== null) {
		if (row.type === "cash_game") {
			group.cashNormSum += norm;
			group.cashNormCount += 1;
		} else {
			group.tournamentNormSum += norm;
			group.tournamentNormCount += 1;
		}
	}
	// A win is always currency-sign positive, regardless of normalization.
	if (row.profitLoss > 0) {
		group.winCount += 1;
	}
	group.playMinutes += row.playMinutes ?? 0;
}

export function breakdownStats(
	rows: StatsSessionRow[],
	groupBy: BreakdownGroupBy
): BreakdownRow[] {
	const groups = new Map<string, BreakdownAccumulator>();

	for (const row of rows) {
		const keyLabel = breakdownKeyLabel(row, groupBy);
		if (keyLabel === null) {
			continue;
		}
		let group = groups.get(keyLabel.key);
		if (!group) {
			group = {
				key: keyLabel.key,
				label: keyLabel.label,
				sessions: 0,
				profitLoss: 0,
				cashNormSum: 0,
				cashNormCount: 0,
				tournamentNormSum: 0,
				tournamentNormCount: 0,
				winCount: 0,
				playMinutes: 0,
			};
			groups.set(keyLabel.key, group);
		}
		accumulateBreakdownRow(group, row);
	}

	const result: BreakdownRow[] = [...groups.values()].map((g) => ({
		key: g.key,
		label: g.label,
		sessions: g.sessions,
		profitLoss: g.profitLoss,
		cashNormalizedProfitLoss: g.cashNormCount > 0 ? g.cashNormSum : null,
		tournamentNormalizedProfitLoss:
			g.tournamentNormCount > 0 ? g.tournamentNormSum : null,
		winRate: (g.winCount / g.sessions) * 100,
		playMinutes: g.playMinutes,
	}));

	return sortBreakdownRows(result, groupBy);
}

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

export interface StreakResult {
	currentLoseStreak: number;
	currentWinStreak: number;
	maxLoseStreak: number;
	maxWinStreak: number;
}

function sortChronological(rows: StatsSessionRow[]): StatsSessionRow[] {
	return [...rows].sort((a, b) => {
		if (a.sessionDate !== b.sessionDate) {
			return a.sessionDate - b.sessionDate;
		}
		return a.id.localeCompare(b.id);
	});
}

function computeMaxStreaks(ordered: StatsSessionRow[]): {
	maxWinStreak: number;
	maxLoseStreak: number;
} {
	let maxWinStreak = 0;
	let maxLoseStreak = 0;
	let runWin = 0;
	let runLose = 0;

	for (const row of ordered) {
		if (row.profitLoss > 0) {
			runWin += 1;
			runLose = 0;
		} else if (row.profitLoss < 0) {
			runLose += 1;
			runWin = 0;
		} else {
			runWin = 0;
			runLose = 0;
		}
		maxWinStreak = Math.max(maxWinStreak, runWin);
		maxLoseStreak = Math.max(maxLoseStreak, runLose);
	}

	return { maxWinStreak, maxLoseStreak };
}

function computeCurrentStreaks(ordered: StatsSessionRow[]): {
	currentWinStreak: number;
	currentLoseStreak: number;
} {
	let currentWinStreak = 0;
	let currentLoseStreak = 0;

	for (let i = ordered.length - 1; i >= 0; i--) {
		const pl = ordered[i]?.profitLoss ?? 0;
		// A break-even (or opposite-sign) session ends the trailing run.
		if (pl > 0 && currentLoseStreak === 0) {
			currentWinStreak += 1;
		} else if (pl < 0 && currentWinStreak === 0) {
			currentLoseStreak += 1;
		} else {
			break;
		}
	}

	return { currentWinStreak, currentLoseStreak };
}

/**
 * Streaks are always computed on currency profit/loss (not normalized).
 * A session with PL === 0 is neither a win nor a loss and resets both running
 * streaks. current* counts from the LAST session backward.
 */
export function computeStreaks(rows: StatsSessionRow[]): StreakResult {
	const ordered = sortChronological(rows);
	return {
		...computeMaxStreaks(ordered),
		...computeCurrentStreaks(ordered),
	};
}

// ---------------------------------------------------------------------------
// Highlights
// ---------------------------------------------------------------------------

export interface HighlightSession {
	date: number;
	id: string;
	normalizedProfitLoss: number | null;
	profitLoss: number;
	type: "cash_game" | "tournament";
}

export interface LongestSession {
	date: number;
	id: string;
	playMinutes: number;
}

export interface HighlightsResult {
	bestSession: HighlightSession | null;
	longestSession: LongestSession | null;
	worstSession: HighlightSession | null;
}

function toHighlightSession(row: StatsSessionRow): HighlightSession {
	return {
		id: row.id,
		date: row.sessionDate,
		profitLoss: row.profitLoss,
		normalizedProfitLoss: normalizedSessionValue(row),
		type: row.type,
	};
}

/** Highlights always use currency profit/loss for best/worst selection. */
export function computeHighlights(rows: StatsSessionRow[]): HighlightsResult {
	if (rows.length === 0) {
		return { bestSession: null, worstSession: null, longestSession: null };
	}

	let best = rows[0] as StatsSessionRow;
	let worst = rows[0] as StatsSessionRow;
	let longest: StatsSessionRow | null = null;

	for (const row of rows) {
		if (row.profitLoss > best.profitLoss) {
			best = row;
		}
		if (row.profitLoss < worst.profitLoss) {
			worst = row;
		}
		if (
			row.playMinutes !== null &&
			(longest === null || (longest.playMinutes ?? 0) < row.playMinutes)
		) {
			longest = row;
		}
	}

	return {
		bestSession: toHighlightSession(best),
		worstSession: toHighlightSession(worst),
		longestSession:
			longest === null
				? null
				: {
						id: longest.id,
						date: longest.sessionDate,
						playMinutes: longest.playMinutes as number,
					},
	};
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const statsRouter = router({
	summary: protectedProcedure
		.input(statsFilterSchema)
		.query(async ({ ctx, input }) => {
			assertCurrencyScope(input);
			const rows = await fetchStatsRows(ctx.db, ctx.session.user.id, input);
			return summarizeStats(rows);
		}),

	breakdown: protectedProcedure
		.input(breakdownFilterSchema)
		.query(async ({ ctx, input }) => {
			assertCurrencyScope(input);
			const rows = await fetchStatsRows(ctx.db, ctx.session.user.id, input);
			return { groups: breakdownStats(rows, input.groupBy) };
		}),

	highlights: protectedProcedure
		.input(statsFilterSchema)
		.query(async ({ ctx, input }) => {
			assertCurrencyScope(input);
			const rows = await fetchStatsRows(ctx.db, ctx.session.user.id, input);
			return { ...computeHighlights(rows), ...computeStreaks(rows) };
		}),

	profitLossSeries: protectedProcedure
		.input(statsFilterSchema)
		.query(({ ctx, input }) => {
			assertCurrencyScope(input);
			return fetchProfitLossSeries(ctx.db, ctx.session.user.id, input);
		}),
});
