import type { SessionStatus } from "@sapphire2/db/constants/session-event-types";
import {
	allInPayload,
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipsAddRemovePayload,
	purchaseChipsPayload,
	tournamentSessionEndPayload,
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
	beforeDeadline: boolean;
	bountyPrizes: number | null;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number | null;
	rebuyCost: number;
	rebuyCount: number;
	totalEntries: number | null;
}

interface SessionState {
	endedAt: Date | null;
	startedAt: Date | null;
	status: SessionStatus;
}

export function computeBreakMinutesFromEvents(
	events: { eventType: string; occurredAt: Date }[]
): number {
	let totalBreakMs = 0;
	let pausedAt: Date | null = null;

	for (const event of events) {
		if (event.eventType === "session_pause") {
			pausedAt = event.occurredAt;
		} else if (event.eventType === "session_resume" && pausedAt) {
			totalBreakMs += event.occurredAt.getTime() - pausedAt.getTime();
			pausedAt = null;
		}
	}

	if (pausedAt) {
		totalBreakMs += Date.now() - pausedAt.getTime();
	}

	return Math.floor(totalBreakMs / (1000 * 60));
}

export function computeSessionStateFromEvents(
	events: { eventType: string; occurredAt: Date }[]
): SessionState {
	let startedAt: Date | null = null;
	let endedAt: Date | null = null;
	let lastStateEvent: string | null = null;

	for (const event of events) {
		if (event.eventType === "session_start") {
			if (startedAt === null) {
				startedAt = event.occurredAt;
			}
			lastStateEvent = "session_start";
		}
		if (event.eventType === "session_end") {
			endedAt = event.occurredAt;
			lastStateEvent = "session_end";
		}
		if (event.eventType === "session_pause") {
			lastStateEvent = "session_pause";
		}
		if (event.eventType === "session_resume") {
			lastStateEvent = "session_resume";
		}
	}

	let status: SessionStatus = "active";
	if (lastStateEvent === "session_end") {
		status = "completed";
	} else if (lastStateEvent === "session_pause") {
		status = "paused";
	}

	return { startedAt, endedAt, status };
}

export function computeCashGamePLFromEvents(
	events: { eventType: string; payload: string }[]
): CashGamePLResult {
	let totalBuyIn = 0;
	let addonTotal = 0;
	let chipRemoveTotal = 0;
	let cashOut: number | null = null;
	let totalEvDiff = 0;

	for (const event of events) {
		const parsed = JSON.parse(event.payload);

		if (event.eventType === "session_start") {
			const data = cashSessionStartPayload.parse(parsed);
			totalBuyIn += data.buyInAmount;
		} else if (event.eventType === "chips_add_remove") {
			const data = chipsAddRemovePayload.parse(parsed);
			if (data.type === "add") {
				totalBuyIn += data.amount;
				addonTotal += data.amount;
			} else {
				chipRemoveTotal += data.amount;
			}
		} else if (event.eventType === "all_in") {
			const data = allInPayload.parse(parsed);
			totalEvDiff +=
				data.potSize * (data.equity / 100) -
				(data.potSize / data.trials) * data.wins;
		} else if (event.eventType === "session_end") {
			const data = cashSessionEndPayload.parse(parsed);
			cashOut = data.cashOutAmount;
		}
	}

	const profitLoss =
		cashOut === null ? null : cashOut + chipRemoveTotal - totalBuyIn;
	const evCashOut = cashOut === null ? null : cashOut + totalEvDiff;

	return { totalBuyIn, cashOut, profitLoss, evCashOut, addonTotal };
}

export function computeTournamentPLFromEvents(
	events: { eventType: string; payload: string }[],
	tournamentBuyIn?: number,
	tournamentEntryFee?: number
): TournamentPLResult {
	let chipPurchaseCount = 0;
	let totalChipPurchaseCost = 0;
	let placement: number | null = null;
	let totalEntries: number | null = null;
	let prizeMoney: number | null = null;
	let bountyPrizes: number | null = null;
	let beforeDeadline = false;

	for (const event of events) {
		const parsed = JSON.parse(event.payload);

		if (event.eventType === "purchase_chips") {
			const data = purchaseChipsPayload.parse(parsed);
			chipPurchaseCount++;
			totalChipPurchaseCost += data.cost;
		} else if (event.eventType === "session_end") {
			const result = tournamentSessionEndPayload.safeParse(parsed);
			if (result.success) {
				prizeMoney = result.data.prizeMoney;
				bountyPrizes = result.data.bountyPrizes;
				if (result.data.beforeDeadline === false) {
					placement = result.data.placement;
					totalEntries = result.data.totalEntries;
				} else {
					beforeDeadline = true;
				}
			}
		}
	}

	const income = (prizeMoney ?? 0) + (bountyPrizes ?? 0);
	const cost =
		(tournamentBuyIn ?? 0) + (tournamentEntryFee ?? 0) + totalChipPurchaseCost;
	// profitLoss is null if session ended before deadline (no placement) or not yet completed
	const profitLoss =
		prizeMoney === null || beforeDeadline ? null : income - cost;

	return {
		rebuyCount: chipPurchaseCount,
		rebuyCost: totalChipPurchaseCost,
		addonCount: 0,
		addonCost: 0,
		beforeDeadline,
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

async function deletePokerSessionAndTransaction(
	db: DbInstance,
	liveSessionFilter: Parameters<typeof eq>[1],
	liveSessionColumn: Parameters<typeof eq>[0]
): Promise<void> {
	const [existing] = await db
		.select()
		.from(pokerSession)
		.where(eq(liveSessionColumn, liveSessionFilter));

	if (!existing) {
		return;
	}

	await db
		.delete(currencyTransaction)
		.where(eq(currencyTransaction.sessionId, existing.id));

	await db.delete(pokerSession).where(eq(pokerSession.id, existing.id));
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

	// Derive status, startedAt, endedAt from events
	const state = computeSessionStateFromEvents(events);

	// Fetch live session for metadata
	const [session] = await db
		.select()
		.from(liveCashGameSession)
		.where(eq(liveCashGameSession.id, liveCashGameSessionId));

	if (!session) {
		return;
	}

	// Update live session with all derived state
	await db
		.update(liveCashGameSession)
		.set({
			status: state.status,
			startedAt: state.startedAt ?? session.startedAt,
			endedAt: state.status === "completed" ? (state.endedAt ?? null) : null,
			updatedAt: new Date(),
		})
		.where(eq(liveCashGameSession.id, liveCashGameSessionId));

	if (state.status !== "completed") {
		// Clean up any lingering pokerSession from a previous completion
		await deletePokerSessionAndTransaction(
			db,
			liveCashGameSessionId,
			pokerSession.liveCashGameSessionId
		);
		return;
	}

	// status === "completed": compute P&L, break minutes, upsert pokerSession
	const pl = computeCashGamePLFromEvents(events);
	const breakMinutes = computeBreakMinutesFromEvents(events);
	const breakMinutesValue = breakMinutes > 0 ? breakMinutes : null;
	const now = new Date();

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
				startedAt: state.startedAt,
				endedAt: state.endedAt,
				breakMinutes: breakMinutesValue,
				sessionDate: state.startedAt ?? session.startedAt,
				updatedAt: now,
			})
			.where(eq(pokerSession.id, pokerSessionId));
	} else {
		pokerSessionId = crypto.randomUUID();
		await db.insert(pokerSession).values({
			id: pokerSessionId,
			userId,
			type: "cash_game",
			sessionDate: state.startedAt ?? session.startedAt,
			storeId: session.storeId ?? null,
			ringGameId: session.ringGameId ?? null,
			currencyId: session.currencyId ?? null,
			liveCashGameSessionId,
			buyIn: pl.totalBuyIn,
			cashOut: pl.cashOut,
			evCashOut: pl.evCashOut,
			startedAt: state.startedAt ?? session.startedAt,
			endedAt: state.endedAt,
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
		state.startedAt ?? session.startedAt,
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
	state: SessionState,
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
				beforeDeadline: pl.beforeDeadline ? true : null,
				prizeMoney: pl.prizeMoney,
				bountyPrizes: pl.bountyPrizes,
				rebuyCount: pl.rebuyCount,
				rebuyCost: pl.rebuyCost > 0 ? pl.rebuyCost : null,
				addonCost: pl.addonCost > 0 ? pl.addonCost : null,
				startedAt: state.startedAt,
				endedAt: state.endedAt,
				breakMinutes: breakMinutesValue,
				sessionDate: state.startedAt ?? session.startedAt,
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
		sessionDate: state.startedAt ?? session.startedAt,
		storeId: session.storeId ?? null,
		tournamentId: session.tournamentId ?? null,
		currencyId: session.currencyId ?? null,
		liveTournamentSessionId,
		tournamentBuyIn: tournamentBuyIn ?? null,
		entryFee: entryFee ?? null,
		placement: pl.placement,
		totalEntries: pl.totalEntries,
		beforeDeadline: pl.beforeDeadline ? true : null,
		prizeMoney: pl.prizeMoney,
		bountyPrizes: pl.bountyPrizes,
		rebuyCount: pl.rebuyCount,
		rebuyCost: pl.rebuyCost > 0 ? pl.rebuyCost : null,
		addonCost: pl.addonCost > 0 ? pl.addonCost : null,
		startedAt: state.startedAt ?? session.startedAt,
		endedAt: state.endedAt,
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

	// Derive status, startedAt, endedAt from events
	const state = computeSessionStateFromEvents(events);

	// Fetch live session for metadata
	const [session] = await db
		.select()
		.from(liveTournamentSession)
		.where(eq(liveTournamentSession.id, liveTournamentSessionId));

	if (!session) {
		return;
	}

	// Update live session with all derived state
	await db
		.update(liveTournamentSession)
		.set({
			status: state.status,
			startedAt: state.startedAt ?? session.startedAt,
			endedAt: state.status === "completed" ? (state.endedAt ?? null) : null,
			updatedAt: new Date(),
		})
		.where(eq(liveTournamentSession.id, liveTournamentSessionId));

	if (state.status !== "completed") {
		// Clean up any lingering pokerSession from a previous completion
		await deletePokerSessionAndTransaction(
			db,
			liveTournamentSessionId,
			pokerSession.liveTournamentSessionId
		);
		return;
	}

	// status === "completed": compute P&L, break minutes, upsert pokerSession
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
		state,
		breakMinutesValue,
		tournamentBuyIn,
		entryFee
	);

	await syncCurrencyTransaction(
		db,
		pokerSessionId,
		session.currencyId,
		pl.profitLoss,
		state.startedAt ?? session.startedAt,
		userId
	);
}
