import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionChipPurchaseResult } from "@sapphire2/db/schema/session-chip-purchase-result";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { protectedProcedure } from "../index";
import { selectInChunks } from "../lib/batch";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

function computeCashGamePL(
	buyIn: number,
	cashOut: number,
	chipRemoveTotal = 0
): number {
	return cashOut + chipRemoveTotal - buyIn;
}

export function resolveEvCashOut(
	evCashOut: number | null,
	cashOut: number
): number;
export function resolveEvCashOut(
	evCashOut: number | null,
	cashOut: number | null
): number | null;
export function resolveEvCashOut(
	evCashOut: number | null,
	cashOut: number | null
): number | null {
	return evCashOut ?? cashOut;
}

function computeTournamentPL(
	tournamentBuyIn: number | null,
	entryFee: number | null,
	chipPurchaseCost: number,
	prizeMoney: number | null,
	bountyPrizes: number | null
): number {
	const income = (prizeMoney ?? 0) + (bountyPrizes ?? 0);
	const cost = (tournamentBuyIn ?? 0) + (entryFee ?? 0) + chipPurchaseCost;
	return income - cost;
}

interface SessionChipPurchaseWithCount {
	chips: number;
	cost: number;
	count: number;
	id: string;
	name: string;
	sortOrder: number;
}

function sumChipPurchaseCost(
	purchases: { cost: number; count: number }[]
): number {
	return purchases.reduce((acc, p) => acc + p.cost * p.count, 0);
}

async function getSessionChipPurchaseMap(
	db: DbInstance,
	sessionIds: string[]
): Promise<Map<string, SessionChipPurchaseWithCount[]>> {
	const map = new Map<string, SessionChipPurchaseWithCount[]>();
	if (sessionIds.length === 0) {
		return map;
	}
	const rows = await selectInChunks(sessionIds, (chunk) =>
		db
			.select({
				sessionId: sessionChipPurchase.sessionId,
				id: sessionChipPurchase.id,
				name: sessionChipPurchase.name,
				cost: sessionChipPurchase.cost,
				chips: sessionChipPurchase.chips,
				sortOrder: sessionChipPurchase.sortOrder,
				count: sessionChipPurchaseResult.count,
			})
			.from(sessionChipPurchase)
			.leftJoin(
				sessionChipPurchaseResult,
				eq(
					sessionChipPurchaseResult.sessionChipPurchaseId,
					sessionChipPurchase.id
				)
			)
			.where(inArray(sessionChipPurchase.sessionId, chunk))
			.orderBy(asc(sessionChipPurchase.sortOrder))
	);
	for (const r of rows) {
		const entry: SessionChipPurchaseWithCount = {
			id: r.id,
			name: r.name,
			cost: r.cost,
			chips: r.chips,
			sortOrder: r.sortOrder,
			count: r.count ?? 0,
		};
		const existing = map.get(r.sessionId);
		if (existing) {
			existing.push(entry);
		} else {
			map.set(r.sessionId, [entry]);
		}
	}
	return map;
}

export function sessionOrderKeySql() {
	return sql`coalesce(${gameSession.startedAt}, ${gameSession.sessionDate})`;
}

export interface ProfitLossSeriesRow {
	bountyPrizes: number | null;
	breakMinutes: number | null;
	buyIn: number | null;
	cashOut: number | null;
	chipPurchaseCost: number;
	chipRemoveTotal: number | null;
	endedAt: Date | null;
	entryFee: number | null;
	evCashOut: number | null;
	id: string;
	prizeMoney: number | null;
	ringGameBlind2: number | null;
	sessionDate: Date;
	startedAt: Date | null;
	tournamentBuyIn: number | null;
	type: string;
}

interface CashGameStats {
	buyInTotal: number | null;
	evProfitLoss: number | null;
	profitLoss: number;
}

function computeCashStats(r: ProfitLossSeriesRow): CashGameStats {
	if (r.buyIn === null || r.cashOut === null) {
		return { profitLoss: 0, evProfitLoss: null, buyInTotal: null };
	}
	const chipRemoveTotal = r.chipRemoveTotal ?? 0;
	const evCashOut = resolveEvCashOut(r.evCashOut, r.cashOut);
	return {
		profitLoss: computeCashGamePL(r.buyIn, r.cashOut, chipRemoveTotal),
		evProfitLoss: computeCashGamePL(r.buyIn, evCashOut, chipRemoveTotal),
		buyInTotal: r.buyIn,
	};
}

interface TournamentStats {
	buyInTotal: number | null;
	profitLoss: number;
}

function computeTournamentStats(r: ProfitLossSeriesRow): TournamentStats {
	const profitLoss = computeTournamentPL(
		r.tournamentBuyIn,
		r.entryFee,
		r.chipPurchaseCost,
		r.prizeMoney,
		r.bountyPrizes
	);
	const total =
		(r.tournamentBuyIn ?? 0) + (r.entryFee ?? 0) + r.chipPurchaseCost;
	return { profitLoss, buyInTotal: total === 0 ? null : total };
}

function computePlayMinutes(r: ProfitLossSeriesRow): number | null {
	if (!(r.startedAt && r.endedAt)) {
		return null;
	}
	const elapsed = Math.max(
		0,
		(r.endedAt.getTime() - r.startedAt.getTime()) / 60_000
	);
	return Math.max(0, elapsed - (r.breakMinutes ?? 0));
}

interface ProfitLossSeriesFilters {
	currencyId?: string;
	dateFrom?: number;
	dateTo?: number;
	ringGameId?: string;
	roomId?: string;
	type?: "cash_game" | "tournament";
}

export async function fetchProfitLossSeries(
	db: DbInstance,
	userId: string,
	input: ProfitLossSeriesFilters
) {
	const conditions = [eq(gameSession.userId, userId)];
	if (input.type) {
		conditions.push(eq(gameSession.kind, input.type));
	}
	if (input.roomId) {
		conditions.push(eq(gameSession.roomId, input.roomId));
	}
	if (input.currencyId) {
		conditions.push(eq(gameSession.currencyId, input.currencyId));
	}
	if (input.ringGameId) {
		conditions.push(eq(sessionCashDetail.ringGameId, input.ringGameId));
	}
	if (input.dateFrom !== undefined) {
		conditions.push(
			gte(gameSession.sessionDate, new Date(input.dateFrom * 1000))
		);
	}
	if (input.dateTo !== undefined) {
		conditions.push(
			lte(gameSession.sessionDate, new Date(input.dateTo * 1000))
		);
	}

	const rows = await db
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
			chipRemoveTotal: sessionCashDetail.chipRemoveTotal,
			ringGameBlind2: sessionCashDetail.blind2,
			tournamentBuyIn: sessionTournamentDetail.tournamentBuyIn,
			entryFee: sessionTournamentDetail.entryFee,
			prizeMoney: sessionTournamentDetail.prizeMoney,
			bountyPrizes: sessionTournamentDetail.bountyPrizes,
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
		.where(and(...conditions))
		.orderBy(asc(sessionOrderKeySql()), asc(gameSession.id));

	const chipPurchaseMap = await getSessionChipPurchaseMap(
		db,
		rows.map((r) => r.id)
	);
	const points = rows.map((r) =>
		toProfitLossSeriesPoint({
			...r,
			chipPurchaseCost: sumChipPurchaseCost(chipPurchaseMap.get(r.id) ?? []),
		})
	);

	return { points };
}

export function toProfitLossSeriesPoint(r: ProfitLossSeriesRow) {
	const cashStats =
		r.type === "cash_game"
			? computeCashStats(r)
			: ({
					profitLoss: 0,
					evProfitLoss: null,
					buyInTotal: null,
				} satisfies CashGameStats);
	const tourneyStats =
		r.type === "tournament"
			? computeTournamentStats(r)
			: ({ profitLoss: 0, buyInTotal: null } satisfies TournamentStats);
	const profitLoss =
		r.type === "cash_game" ? cashStats.profitLoss : tourneyStats.profitLoss;
	const buyInTotal =
		r.type === "cash_game" ? cashStats.buyInTotal : tourneyStats.buyInTotal;
	return {
		id: r.id,
		type: r.type as "cash_game" | "tournament",
		sessionDate: Math.floor(r.sessionDate.getTime() / 1000),
		sortKey: Math.floor((r.startedAt ?? r.sessionDate).getTime() / 1000),
		profitLoss,
		evProfitLoss: cashStats.evProfitLoss,
		evRecorded: r.type === "cash_game" && r.evCashOut !== null,
		playMinutes: computePlayMinutes(r),
		bigBlind: r.ringGameBlind2 ?? null,
		buyInTotal,
	};
}

export {
	computeCashGamePL,
	computeTournamentPL,
	getSessionChipPurchaseMap,
	sumChipPurchaseCost,
};
