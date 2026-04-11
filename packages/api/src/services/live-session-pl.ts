import {
	chipAddPayload,
	stackRecordPayload,
	tournamentResultPayload,
	tournamentStackRecordPayload,
} from "@sapphire2/db/constants/session-event-types";
import { liveCashGameSession } from "@sapphire2/db/schema/live-cash-game-session";
import { liveTournamentSession } from "@sapphire2/db/schema/live-tournament-session";
import { pokerSession } from "@sapphire2/db/schema/session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import {
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/store";
import { tournament } from "@sapphire2/db/schema/tournament";
import { and, asc, eq } from "drizzle-orm";
import type { protectedProcedure } from "../index";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

interface CashGamePLResult {
	addonTotal: number;
	cashOut: number | null;
	evCashOut: number | null;
	profitLoss: number | null;
	totalBuyIn: number;
}

interface TournamentPLResult {
	addonCost: number;
	addonCount: number;
	bountyPrizes: number | null;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number | null;
	rebuyCost: number;
	rebuyCount: number;
	totalEntries: number | null;
}

export function computeBreakMinutesFromEvents(
	events: { eventType: string; occurredAt: Date }[]
): number {
	let totalBreakMs = 0;
	let lastSessionEndAt: Date | null = null;

	for (const event of events) {
		if (event.eventType === "session_end") {
			lastSessionEndAt = event.occurredAt;
		} else if (event.eventType === "session_start" && lastSessionEndAt) {
			totalBreakMs += event.occurredAt.getTime() - lastSessionEndAt.getTime();
			lastSessionEndAt = null;
		}
	}

	return Math.floor(totalBreakMs / (1000 * 60));
}

interface SessionTimestamps {
	endedAt: Date | null;
	startedAt: Date | null;
}

export function computeTimestampsFromEvents(
	events: { eventType: string; occurredAt: Date }[]
): SessionTimestamps {
	let startedAt: Date | null = null;
	let endedAt: Date | null = null;

	for (const event of events) {
		if (event.eventType === "session_start" && startedAt === null) {
			startedAt = event.occurredAt;
		}
		if (event.eventType === "session_end") {
			endedAt = event.occurredAt;
		}
	}

	return { startedAt, endedAt };
}

export function computeCashGamePLFromEvents(
	events: { eventType: string; payload: string }[]
): CashGamePLResult {
	let totalBuyIn = 0;
	let addonTotal = 0;
	let cashOut: number | null = null;
	let totalEvDiff = 0;
	let isFirstChipAdd = true;

	for (const event of events) {
		const parsed = JSON.parse(event.payload);

		if (event.eventType === "chip_add") {
			const data = chipAddPayload.parse(parsed);
			totalBuyIn += data.amount;
			if (isFirstChipAdd) {
				isFirstChipAdd = false;
			} else {
				addonTotal += data.amount;
			}
		} else if (event.eventType === "stack_record") {
			const data = stackRecordPayload.parse(parsed);
			cashOut = data.stackAmount;
			for (const allIn of data.allIns) {
				totalEvDiff +=
					allIn.potSize * (allIn.equity / 100) * allIn.trials -
					allIn.potSize * allIn.wins;
			}
		}
	}

	const profitLoss = cashOut === null ? null : cashOut - totalBuyIn;
	const evCashOut = cashOut === null ? null : cashOut + totalEvDiff;

	return { totalBuyIn, cashOut, profitLoss, evCashOut, addonTotal };
}

function processStackRecordPurchases(data: {
	chipPurchases: Array<{ name: string; cost: number; chips: number }>;
	rebuy?: { cost: number; chips: number } | null;
	addon?: { cost: number; chips: number } | null;
}): {
	rebuyCount: number;
	rebuyCost: number;
	addonCount: number;
	addonCost: number;
} {
	let rebuyCount = 0;
	let rebuyCost = 0;
	let addonCount = 0;
	let addonCost = 0;

	if (data.chipPurchases.length > 0) {
		for (const cp of data.chipPurchases) {
			if (cp.name.toLowerCase().includes("rebuy")) {
				rebuyCount++;
				rebuyCost += cp.cost;
			} else {
				addonCount++;
				addonCost += cp.cost;
			}
		}
	} else {
		// Legacy fallback: process old rebuy/addon fields
		if (data.rebuy) {
			rebuyCount++;
			rebuyCost += data.rebuy.cost;
		}
		if (data.addon) {
			addonCount++;
			addonCost += data.addon.cost;
		}
	}

	return { rebuyCount, rebuyCost, addonCount, addonCost };
}

export function computeTournamentPLFromEvents(
	events: { eventType: string; payload: string }[],
	tournamentBuyIn?: number,
	tournamentEntryFee?: number
): TournamentPLResult {
	let rebuyCount = 0;
	let rebuyCost = 0;
	let addonCount = 0;
	let addonCost = 0;
	let placement: number | null = null;
	let totalEntries: number | null = null;
	let prizeMoney: number | null = null;
	let bountyPrizes: number | null = null;

	for (const event of events) {
		const parsed = JSON.parse(event.payload);

		if (event.eventType === "tournament_stack_record") {
			const data = tournamentStackRecordPayload.parse(parsed);
			const counts = processStackRecordPurchases(data);
			rebuyCount += counts.rebuyCount;
			rebuyCost += counts.rebuyCost;
			addonCount += counts.addonCount;
			addonCost += counts.addonCost;
		} else if (event.eventType === "tournament_result") {
			const data = tournamentResultPayload.parse(parsed);
			placement = data.placement;
			totalEntries = data.totalEntries;
			prizeMoney = data.prizeMoney;
			bountyPrizes = data.bountyPrizes;
		}
	}

	const income = (prizeMoney ?? 0) + (bountyPrizes ?? 0);
	const cost =
		(tournamentBuyIn ?? 0) + (tournamentEntryFee ?? 0) + rebuyCost + addonCost;
	const profitLoss = placement === null ? null : income - cost;

	return {
		rebuyCount,
		rebuyCost,
		addonCount,
		addonCost,
		placement,
		totalEntries,
		prizeMoney,
		bountyPrizes,
		profitLoss,
	};
}

export async function getSessionResultTypeId(
	db: DbInstance,
	userId: string
): Promise<string> {
	const [found] = await db
		.select()
		.from(transactionType)
		.where(
			and(
				eq(transactionType.userId, userId),
				eq(transactionType.name, "Session Result")
			)
		);
	if (found) {
		return found.id;
	}

	const id = crypto.randomUUID();
	await db.insert(transactionType).values({
		id,
		userId,
		name: "Session Result",
		updatedAt: new Date(),
	});
	return id;
}

async function syncCurrencyTransaction(
	db: DbInstance,
	pokerSessionId: string,
	currencyId: string | null,
	profitLoss: number | null,
	sessionDate: Date,
	userId: string
): Promise<void> {
	if (!currencyId || profitLoss === null) {
		return;
	}

	const [existingTx] = await db
		.select()
		.from(currencyTransaction)
		.where(eq(currencyTransaction.sessionId, pokerSessionId));

	if (existingTx) {
		await db
			.update(currencyTransaction)
			.set({ amount: profitLoss })
			.where(eq(currencyTransaction.id, existingTx.id));
	} else {
		const typeId = await getSessionResultTypeId(db, userId);
		await db.insert(currencyTransaction).values({
			id: crypto.randomUUID(),
			currencyId,
			transactionTypeId: typeId,
			sessionId: pokerSessionId,
			amount: profitLoss,
			transactedAt: sessionDate,
		});
	}
}

export async function recalculateCashGameSession(
	db: DbInstance,
	liveCashGameSessionId: string,
	userId: string
): Promise<void> {
	// Fetch all events ordered by sortOrder
	const events = await db
		.select()
		.from(sessionEvent)
		.where(eq(sessionEvent.liveCashGameSessionId, liveCashGameSessionId))
		.orderBy(asc(sessionEvent.sortOrder));

	// Derive timestamps
	const timestamps = computeTimestampsFromEvents(events);

	// Update live session startedAt (even for active sessions)
	if (timestamps.startedAt) {
		await db
			.update(liveCashGameSession)
			.set({ startedAt: timestamps.startedAt, updatedAt: new Date() })
			.where(eq(liveCashGameSession.id, liveCashGameSessionId));
	}

	// Fetch session to check status and get metadata
	const [session] = await db
		.select()
		.from(liveCashGameSession)
		.where(eq(liveCashGameSession.id, liveCashGameSessionId));

	if (!session || session.status !== "completed") {
		return;
	}

	// Update endedAt for completed sessions
	if (timestamps.endedAt) {
		await db
			.update(liveCashGameSession)
			.set({ endedAt: timestamps.endedAt, updatedAt: new Date() })
			.where(eq(liveCashGameSession.id, liveCashGameSessionId));
	}

	// Compute P&L and break minutes
	const pl = computeCashGamePLFromEvents(events);
	const breakMinutes = computeBreakMinutesFromEvents(events);
	const breakMinutesValue = breakMinutes > 0 ? breakMinutes : null;
	const now = new Date();

	// Upsert pokerSession with ALL derived fields
	const [existingPokerSession] = await db
		.select()
		.from(pokerSession)
		.where(eq(pokerSession.liveCashGameSessionId, liveCashGameSessionId));

	let pokerSessionId: string;

	if (existingPokerSession) {
		pokerSessionId = existingPokerSession.id;
		await db
			.update(pokerSession)
			.set({
				buyIn: pl.totalBuyIn,
				cashOut: pl.cashOut,
				evCashOut: pl.evCashOut,
				startedAt: timestamps.startedAt,
				endedAt: timestamps.endedAt,
				breakMinutes: breakMinutesValue,
				sessionDate: timestamps.startedAt ?? session.startedAt,
				updatedAt: now,
			})
			.where(eq(pokerSession.id, pokerSessionId));
	} else {
		pokerSessionId = crypto.randomUUID();
		await db.insert(pokerSession).values({
			id: pokerSessionId,
			userId,
			type: "cash_game",
			sessionDate: timestamps.startedAt ?? session.startedAt,
			storeId: session.storeId ?? null,
			ringGameId: session.ringGameId ?? null,
			currencyId: session.currencyId ?? null,
			liveCashGameSessionId,
			buyIn: pl.totalBuyIn,
			cashOut: pl.cashOut,
			evCashOut: pl.evCashOut,
			startedAt: timestamps.startedAt ?? session.startedAt,
			endedAt: timestamps.endedAt,
			breakMinutes: breakMinutesValue,
			memo: session.memo ?? null,
			updatedAt: now,
		});
	}

	// Sync currency transaction
	await syncCurrencyTransaction(
		db,
		pokerSessionId,
		session.currencyId,
		pl.profitLoss,
		timestamps.startedAt ?? session.startedAt,
		userId
	);
}

async function resolveTournamentBuyInFees(
	db: DbInstance,
	session: {
		buyIn: number | null;
		entryFee: number | null;
		tournamentId: string | null;
	}
): Promise<{
	tournamentBuyIn: number | undefined;
	entryFee: number | undefined;
}> {
	let tournamentBuyIn = session.buyIn ?? undefined;
	let entryFee = session.entryFee ?? undefined;

	if (session.tournamentId) {
		const [t] = await db
			.select({ buyIn: tournament.buyIn, entryFee: tournament.entryFee })
			.from(tournament)
			.where(eq(tournament.id, session.tournamentId));
		if (t) {
			tournamentBuyIn = session.buyIn ?? t.buyIn ?? undefined;
			entryFee = session.entryFee ?? t.entryFee ?? undefined;
		}
	}

	return { tournamentBuyIn, entryFee };
}

async function upsertTournamentPokerSession(
	db: DbInstance,
	liveTournamentSessionId: string,
	userId: string,
	session: typeof liveTournamentSession.$inferSelect,
	pl: TournamentPLResult,
	timestamps: { startedAt: Date | null; endedAt: Date | null },
	breakMinutesValue: number | null,
	tournamentBuyIn: number | undefined,
	entryFee: number | undefined
): Promise<string> {
	const now = new Date();
	const [existing] = await db
		.select()
		.from(pokerSession)
		.where(eq(pokerSession.liveTournamentSessionId, liveTournamentSessionId));

	if (existing) {
		await db
			.update(pokerSession)
			.set({
				placement: pl.placement,
				totalEntries: pl.totalEntries,
				prizeMoney: pl.prizeMoney,
				bountyPrizes: pl.bountyPrizes,
				rebuyCount: pl.rebuyCount,
				rebuyCost: pl.rebuyCost > 0 ? pl.rebuyCost : null,
				addonCost: pl.addonCost > 0 ? pl.addonCost : null,
				startedAt: timestamps.startedAt,
				endedAt: timestamps.endedAt,
				breakMinutes: breakMinutesValue,
				sessionDate: timestamps.startedAt ?? session.startedAt,
				updatedAt: now,
			})
			.where(eq(pokerSession.id, existing.id));
		return existing.id;
	}

	const id = crypto.randomUUID();
	await db.insert(pokerSession).values({
		id,
		userId,
		type: "tournament",
		sessionDate: timestamps.startedAt ?? session.startedAt,
		storeId: session.storeId ?? null,
		tournamentId: session.tournamentId ?? null,
		currencyId: session.currencyId ?? null,
		liveTournamentSessionId,
		tournamentBuyIn: tournamentBuyIn ?? null,
		entryFee: entryFee ?? null,
		placement: pl.placement,
		totalEntries: pl.totalEntries,
		prizeMoney: pl.prizeMoney,
		bountyPrizes: pl.bountyPrizes,
		rebuyCount: pl.rebuyCount,
		rebuyCost: pl.rebuyCost > 0 ? pl.rebuyCost : null,
		addonCost: pl.addonCost > 0 ? pl.addonCost : null,
		startedAt: timestamps.startedAt ?? session.startedAt,
		endedAt: timestamps.endedAt,
		breakMinutes: breakMinutesValue,
		memo: session.memo ?? null,
		updatedAt: now,
	});
	return id;
}

export async function recalculateTournamentSession(
	db: DbInstance,
	liveTournamentSessionId: string,
	userId: string
): Promise<void> {
	const events = await db
		.select()
		.from(sessionEvent)
		.where(eq(sessionEvent.liveTournamentSessionId, liveTournamentSessionId))
		.orderBy(asc(sessionEvent.sortOrder));

	const timestamps = computeTimestampsFromEvents(events);

	if (timestamps.startedAt) {
		await db
			.update(liveTournamentSession)
			.set({ startedAt: timestamps.startedAt, updatedAt: new Date() })
			.where(eq(liveTournamentSession.id, liveTournamentSessionId));
	}

	const [session] = await db
		.select()
		.from(liveTournamentSession)
		.where(eq(liveTournamentSession.id, liveTournamentSessionId));

	if (!session || session.status !== "completed") {
		return;
	}

	if (timestamps.endedAt) {
		await db
			.update(liveTournamentSession)
			.set({ endedAt: timestamps.endedAt, updatedAt: new Date() })
			.where(eq(liveTournamentSession.id, liveTournamentSessionId));
	}

	const { tournamentBuyIn, entryFee } = await resolveTournamentBuyInFees(
		db,
		session
	);
	const pl = computeTournamentPLFromEvents(events, tournamentBuyIn, entryFee);
	const breakMinutes = computeBreakMinutesFromEvents(events);
	const breakMinutesValue = breakMinutes > 0 ? breakMinutes : null;

	const pokerSessionId = await upsertTournamentPokerSession(
		db,
		liveTournamentSessionId,
		userId,
		session,
		pl,
		timestamps,
		breakMinutesValue,
		tournamentBuyIn,
		entryFee
	);

	await syncCurrencyTransaction(
		db,
		pokerSessionId,
		session.currencyId,
		pl.profitLoss,
		timestamps.startedAt ?? session.startedAt,
		userId
	);
}
