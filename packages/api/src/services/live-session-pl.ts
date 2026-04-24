import type { SessionStatus } from "@sapphire2/db/constants/session-event-types";
import {
	allInPayload,
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipsAddRemovePayload,
	purchaseChipsPayload,
	tournamentSessionEndPayload,
} from "@sapphire2/db/constants/session-event-types";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
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
	evDiff: number;
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

	return {
		totalBuyIn,
		cashOut,
		profitLoss,
		evCashOut,
		evDiff: totalEvDiff,
		addonTotal,
	};
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
	const profitLoss = prizeMoney === null ? null : income - cost;

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
	sessionId: string,
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
		.where(eq(currencyTransaction.sessionId, sessionId));

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
			sessionId,
			amount: profitLoss,
			transactedAt: sessionDate,
		});
	}
}

async function deleteCurrencyTransaction(
	db: DbInstance,
	sessionId: string
): Promise<void> {
	await db
		.delete(currencyTransaction)
		.where(eq(currencyTransaction.sessionId, sessionId));
}

export async function recalculateCashGameSession(
	db: DbInstance,
	sessionId: string,
	userId: string
): Promise<void> {
	const events = await db
		.select()
		.from(sessionEvent)
		.where(eq(sessionEvent.sessionId, sessionId))
		.orderBy(asc(sessionEvent.sortOrder));

	const state = computeSessionStateFromEvents(events);

	const [session] = await db
		.select()
		.from(gameSession)
		.where(eq(gameSession.id, sessionId));

	if (!session) {
		return;
	}

	await db
		.update(gameSession)
		.set({
			status: state.status,
			startedAt: state.startedAt ?? session.startedAt,
			endedAt: state.status === "completed" ? (state.endedAt ?? null) : null,
			updatedAt: new Date(),
		})
		.where(eq(gameSession.id, sessionId));

	if (state.status !== "completed") {
		await deleteCurrencyTransaction(db, sessionId);
		return;
	}

	const pl = computeCashGamePLFromEvents(events);
	const breakMinutes = computeBreakMinutesFromEvents(events);
	const breakMinutesValue = breakMinutes > 0 ? breakMinutes : null;

	const effectiveSessionDate =
		state.startedAt ?? session.startedAt ?? new Date();

	await db
		.update(gameSession)
		.set({
			breakMinutes: breakMinutesValue,
			sessionDate: effectiveSessionDate,
		})
		.where(eq(gameSession.id, sessionId));

	const [existingDetail] = await db
		.select()
		.from(sessionCashDetail)
		.where(eq(sessionCashDetail.sessionId, sessionId));

	if (existingDetail) {
		await db
			.update(sessionCashDetail)
			.set({
				buyIn: pl.totalBuyIn,
				cashOut: pl.cashOut,
				evCashOut: pl.evCashOut,
			})
			.where(eq(sessionCashDetail.sessionId, sessionId));
	} else {
		await db.insert(sessionCashDetail).values({
			sessionId,
			buyIn: pl.totalBuyIn,
			cashOut: pl.cashOut,
			evCashOut: pl.evCashOut,
		});
	}

	await syncCurrencyTransaction(
		db,
		sessionId,
		session.currencyId,
		pl.profitLoss,
		effectiveSessionDate,
		userId
	);
}

async function resolveTournamentBuyInFees(
	db: DbInstance,
	session: {
		tournamentId: string | null;
	},
	detail: {
		tournamentBuyIn: number | null;
		entryFee: number | null;
	}
): Promise<{
	tournamentBuyIn: number | undefined;
	entryFee: number | undefined;
}> {
	let tournamentBuyIn = detail.tournamentBuyIn ?? undefined;
	let entryFee = detail.entryFee ?? undefined;

	if (session.tournamentId) {
		const [t] = await db
			.select({ buyIn: tournament.buyIn, entryFee: tournament.entryFee })
			.from(tournament)
			.where(eq(tournament.id, session.tournamentId));
		if (t) {
			tournamentBuyIn = detail.tournamentBuyIn ?? t.buyIn ?? undefined;
			entryFee = detail.entryFee ?? t.entryFee ?? undefined;
		}
	}

	return { tournamentBuyIn, entryFee };
}

export async function recalculateTournamentSession(
	db: DbInstance,
	sessionId: string,
	userId: string
): Promise<void> {
	const events = await db
		.select()
		.from(sessionEvent)
		.where(eq(sessionEvent.sessionId, sessionId))
		.orderBy(asc(sessionEvent.sortOrder));

	const state = computeSessionStateFromEvents(events);

	const [session] = await db
		.select()
		.from(gameSession)
		.where(eq(gameSession.id, sessionId));

	if (!session) {
		return;
	}

	await db
		.update(gameSession)
		.set({
			status: state.status,
			startedAt: state.startedAt ?? session.startedAt,
			endedAt: state.status === "completed" ? (state.endedAt ?? null) : null,
			updatedAt: new Date(),
		})
		.where(eq(gameSession.id, sessionId));

	if (state.status !== "completed") {
		await deleteCurrencyTransaction(db, sessionId);
		return;
	}

	const [existingDetail] = await db
		.select()
		.from(sessionTournamentDetail)
		.where(eq(sessionTournamentDetail.sessionId, sessionId));

	const { tournamentBuyIn, entryFee } = await resolveTournamentBuyInFees(
		db,
		{ tournamentId: existingDetail?.tournamentId ?? null },
		{
			tournamentBuyIn: existingDetail?.tournamentBuyIn ?? null,
			entryFee: existingDetail?.entryFee ?? null,
		}
	);

	const pl = computeTournamentPLFromEvents(events, tournamentBuyIn, entryFee);
	const breakMinutes = computeBreakMinutesFromEvents(events);
	const breakMinutesValue = breakMinutes > 0 ? breakMinutes : null;

	const effectiveSessionDate =
		state.startedAt ?? session.startedAt ?? new Date();

	await db
		.update(gameSession)
		.set({
			breakMinutes: breakMinutesValue,
			sessionDate: effectiveSessionDate,
		})
		.where(eq(gameSession.id, sessionId));

	const detailUpdate = {
		placement: pl.placement,
		totalEntries: pl.totalEntries,
		beforeDeadline: pl.beforeDeadline ? true : null,
		prizeMoney: pl.prizeMoney,
		bountyPrizes: pl.bountyPrizes,
		rebuyCount: pl.rebuyCount,
		rebuyCost: pl.rebuyCost > 0 ? pl.rebuyCost : null,
		addonCost: pl.addonCost > 0 ? pl.addonCost : null,
	};

	if (existingDetail) {
		await db
			.update(sessionTournamentDetail)
			.set(detailUpdate)
			.where(eq(sessionTournamentDetail.sessionId, sessionId));
	} else {
		await db.insert(sessionTournamentDetail).values({
			sessionId,
			tournamentId: null,
			...detailUpdate,
		});
	}

	await syncCurrencyTransaction(
		db,
		sessionId,
		session.currencyId,
		pl.profitLoss,
		effectiveSessionDate,
		userId
	);
}
