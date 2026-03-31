import {
	chipAddPayload,
	stackRecordPayload,
	tournamentResultPayload,
	tournamentStackRecordPayload,
} from "@sapphire2/db/constants/session-event-types";
import { pokerSession } from "@sapphire2/db/schema/session";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import {
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/store";
import { and, eq } from "drizzle-orm";
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

export function isChipAddEvent(eventType: string): boolean {
	return eventType === "chip_add" || eventType === "cash_game_buy_in";
}

export function isStackRecordEvent(eventType: string): boolean {
	return eventType === "stack_record" || eventType === "cash_game_stack_record";
}

function computeEvDiffFromAllIns(
	allIns: Array<{
		potSize: number;
		trials: number;
		equity: number;
		wins: number;
	}>
): number {
	let total = 0;
	for (const allIn of allIns) {
		total +=
			allIn.potSize * (allIn.equity / 100) * allIn.trials -
			allIn.potSize * allIn.wins;
	}
	return total;
}

export function extractLegacyAddon(parsed: unknown): number {
	if (parsed && typeof parsed === "object" && "addon" in parsed) {
		const rec = parsed as { addon?: { amount?: number } };
		if (rec.addon && typeof rec.addon.amount === "number") {
			return rec.addon.amount;
		}
	}
	return 0;
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

		if (isChipAddEvent(event.eventType)) {
			const data = chipAddPayload.parse(parsed);
			totalBuyIn += data.amount;
			if (isFirstChipAdd) {
				isFirstChipAdd = false;
			} else {
				addonTotal += data.amount;
			}
		} else if (isStackRecordEvent(event.eventType)) {
			const data = stackRecordPayload.parse(parsed);
			cashOut = data.stackAmount;
			totalEvDiff += computeEvDiffFromAllIns(data.allIns);
			const legacyAddon = extractLegacyAddon(parsed);
			totalBuyIn += legacyAddon;
			addonTotal += legacyAddon;
		} else if (event.eventType === "cash_out") {
			const amount = (parsed as { amount?: number }).amount;
			if (typeof amount === "number") {
				cashOut = amount;
			}
		}
	}

	const profitLoss = cashOut !== null ? cashOut - totalBuyIn : null;
	const evCashOut = cashOut !== null ? cashOut + totalEvDiff : null;

	return { totalBuyIn, cashOut, profitLoss, evCashOut, addonTotal };
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
			if (data.rebuy) {
				rebuyCount++;
				rebuyCost += data.rebuy.cost;
			}
			if (data.addon) {
				addonCount++;
				addonCost += data.addon.cost;
			}
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
	const profitLoss = placement !== null ? income - cost : null;

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

async function getSessionResultTypeId(
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

export async function recalculateCashGamePL(
	db: DbInstance,
	liveCashGameSessionId: string,
	userId: string
): Promise<void> {
	// Find the linked pokerSession
	const [session] = await db
		.select()
		.from(pokerSession)
		.where(eq(pokerSession.liveCashGameSessionId, liveCashGameSessionId));

	if (!session) {
		return;
	}

	// Get all events for this live session
	const events = await db
		.select({
			eventType: sessionEvent.eventType,
			payload: sessionEvent.payload,
		})
		.from(sessionEvent)
		.where(eq(sessionEvent.liveCashGameSessionId, liveCashGameSessionId));

	const pl = computeCashGamePLFromEvents(events);

	// Update pokerSession
	await db
		.update(pokerSession)
		.set({
			buyIn: pl.totalBuyIn,
			cashOut: pl.cashOut,
			evCashOut: pl.evCashOut,
			updatedAt: new Date(),
		})
		.where(eq(pokerSession.id, session.id));

	// Sync currency transaction
	if (session.currencyId && pl.profitLoss !== null) {
		const [existingTx] = await db
			.select()
			.from(currencyTransaction)
			.where(eq(currencyTransaction.sessionId, session.id));

		if (existingTx) {
			await db
				.update(currencyTransaction)
				.set({ amount: pl.profitLoss })
				.where(eq(currencyTransaction.id, existingTx.id));
		} else {
			const typeId = await getSessionResultTypeId(db, userId);
			await db.insert(currencyTransaction).values({
				id: crypto.randomUUID(),
				currencyId: session.currencyId,
				transactionTypeId: typeId,
				sessionId: session.id,
				amount: pl.profitLoss,
				transactedAt: session.sessionDate,
			});
		}
	}
}

export async function recalculateTournamentPL(
	db: DbInstance,
	liveTournamentSessionId: string,
	userId: string
): Promise<void> {
	// Find the linked pokerSession
	const [session] = await db
		.select()
		.from(pokerSession)
		.where(eq(pokerSession.liveTournamentSessionId, liveTournamentSessionId));

	if (!session) {
		return;
	}

	// Get all events
	const events = await db
		.select({
			eventType: sessionEvent.eventType,
			payload: sessionEvent.payload,
		})
		.from(sessionEvent)
		.where(eq(sessionEvent.liveTournamentSessionId, liveTournamentSessionId));

	const pl = computeTournamentPLFromEvents(
		events,
		session.tournamentBuyIn ?? undefined,
		session.entryFee ?? undefined
	);

	// Update pokerSession
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
			updatedAt: new Date(),
		})
		.where(eq(pokerSession.id, session.id));

	// Sync currency transaction
	if (session.currencyId && pl.profitLoss !== null) {
		const [existingTx] = await db
			.select()
			.from(currencyTransaction)
			.where(eq(currencyTransaction.sessionId, session.id));

		if (existingTx) {
			await db
				.update(currencyTransaction)
				.set({ amount: pl.profitLoss })
				.where(eq(currencyTransaction.id, existingTx.id));
		} else {
			const typeId = await getSessionResultTypeId(db, userId);
			await db.insert(currencyTransaction).values({
				id: crypto.randomUUID(),
				currencyId: session.currencyId,
				transactionTypeId: typeId,
				sessionId: session.id,
				amount: pl.profitLoss,
				transactedAt: session.sessionDate,
			});
		}
	}
}
