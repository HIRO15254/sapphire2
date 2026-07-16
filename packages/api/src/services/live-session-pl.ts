import type { SessionStatus } from "@sapphire2/db/constants/session-event-types";
import {
	allInPayload,
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipsAddRemovePayload,
	playerJoinPayload,
	playerLeavePayload,
	purchaseChipsPayload,
	tournamentSessionEndPayload,
	virtualAmountPayload,
} from "@sapphire2/db/constants/session-event-types";
import { currencyTransaction } from "@sapphire2/db/schema/currency";
import { itemTransaction } from "@sapphire2/db/schema/item";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionChipPurchaseResult } from "@sapphire2/db/schema/session-chip-purchase-result";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionItemUsage } from "@sapphire2/db/schema/session-item-usage";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { tournament } from "@sapphire2/db/schema/tournament";
import { eq, sql } from "drizzle-orm";
import type { protectedProcedure } from "../index";
import { type BatchStatement, runBatch } from "../lib/batch";
import { sessionEventOrderBy } from "../utils/session-event-time";
import { ensureSessionResultTypeId } from "./session-result-type";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

/** One item-based virtual buy-in / cash-out, snapshotted at usage time. */
export interface SessionItemUsageInput {
	count: number;
	currencyId: string | null;
	direction: "buy_in" | "cash_out";
	itemId: string | null;
	itemName: string;
	unitValue: number;
}

/** Virtual (non-balance-affecting) amounts derived from virtual events.
 * `virtualBuyIn` / `virtualCashOut` hold pure-virtual (no-item) sums only;
 * item-based value is carried per-usage in `itemUsages`. None of these ever
 * feed `profitLoss` or the currency ledger. */
interface VirtualAmountsResult {
	itemUsages: SessionItemUsageInput[];
	virtualBuyIn: number;
	virtualCashOut: number;
}

interface CashGamePLResult extends VirtualAmountsResult {
	addonTotal: number;
	cashOut: number | null;
	/** Σ of chips racked off the table (positive amount of every negative
	 * chips_add_remove). Added back into P/L as already-pocketed chips. */
	chipRemoveTotal: number;
	evCashOut: number | null;
	evDiff: number;
	profitLoss: number | null;
	totalBuyIn: number;
}

interface TournamentPLResult extends VirtualAmountsResult {
	beforeDeadline: boolean;
	bountyPrizes: number | null;
	/** Σ cost across all purchase_chips events. */
	chipPurchaseCost: number;
	/** Purchase count keyed by sessionChipPurchaseId. */
	chipPurchaseCounts: Map<string, number>;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number | null;
	totalEntries: number | null;
}

/** Fold virtual_buy_in / virtual_cash_out events into pure-virtual totals
 * and item usage rows. Shared by the cash and tournament reducers. */
function computeVirtualAmountsFromEvents(
	events: { eventType: string; payload: string }[]
): VirtualAmountsResult {
	let virtualBuyIn = 0;
	let virtualCashOut = 0;
	const itemUsages: SessionItemUsageInput[] = [];

	for (const event of events) {
		if (
			event.eventType !== "virtual_buy_in" &&
			event.eventType !== "virtual_cash_out"
		) {
			continue;
		}
		const data = virtualAmountPayload.parse(JSON.parse(event.payload));
		const direction =
			event.eventType === "virtual_buy_in" ? "buy_in" : "cash_out";

		if (data.itemId === null) {
			if (direction === "buy_in") {
				virtualBuyIn += data.amount;
			} else {
				virtualCashOut += data.amount;
			}
			continue;
		}

		itemUsages.push({
			itemId: data.itemId,
			// The payload refine guarantees itemName / count / unitValue are set
			// whenever itemId is; the fallbacks only satisfy the type system.
			itemName: data.itemName ?? "",
			unitValue: data.unitValue ?? 0,
			currencyId: data.currencyId,
			direction,
			count: data.count ?? 0,
		});
	}

	return { virtualBuyIn, virtualCashOut, itemUsages };
}

/** Net item-count change per item for the holdings ledger: cash-outs gain
 * items (+), buy-ins spend them (−). Items netting to zero are omitted, and
 * usages whose itemId was nulled by item deletion are skipped. */
export function computeNetItemCounts(
	usages: SessionItemUsageInput[]
): Map<string, number> {
	const net = new Map<string, number>();
	for (const usage of usages) {
		if (usage.itemId === null) {
			continue;
		}
		const delta = usage.direction === "cash_out" ? usage.count : -usage.count;
		net.set(usage.itemId, (net.get(usage.itemId) ?? 0) + delta);
	}
	for (const [itemId, count] of net) {
		if (count === 0) {
			net.delete(itemId);
		}
	}
	return net;
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
			if (data.amount > 0) {
				totalBuyIn += data.amount;
				addonTotal += data.amount;
			} else {
				chipRemoveTotal += -data.amount;
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
		chipRemoveTotal,
		profitLoss,
		evCashOut,
		evDiff: totalEvDiff,
		addonTotal,
		...computeVirtualAmountsFromEvents(events),
	};
}

export function computeTournamentPLFromEvents(
	events: { eventType: string; payload: string }[],
	tournamentBuyIn?: number,
	tournamentEntryFee?: number
): TournamentPLResult {
	const chipPurchaseCounts = new Map<string, number>();
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
			chipPurchaseCounts.set(
				data.sessionChipPurchaseId,
				(chipPurchaseCounts.get(data.sessionChipPurchaseId) ?? 0) + 1
			);
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
		chipPurchaseCost: totalChipPurchaseCost,
		chipPurchaseCounts,
		beforeDeadline,
		placement,
		totalEntries,
		prizeMoney,
		bountyPrizes,
		profitLoss,
		...computeVirtualAmountsFromEvents(events),
	};
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
		await deleteCurrencyTransaction(db, sessionId);
		return;
	}

	const [existingTx] = await db
		.select()
		.from(currencyTransaction)
		.where(eq(currencyTransaction.sessionId, sessionId));

	if (existingTx) {
		await db
			.update(currencyTransaction)
			.set({ amount: profitLoss, currencyId, transactedAt: sessionDate })
			.where(eq(currencyTransaction.id, existingTx.id));
	} else {
		const typeId = await ensureSessionResultTypeId(db, userId);
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

/**
 * Rewrite the session's item-usage rows and item-ledger rows from the
 * event-derived usages. DELETE + chunked re-INSERT, all in ONE batch so a
 * mid-way failure cannot strand a deleted usage set (SA2-116). The item
 * ledger gets one net-count row per item (cash-outs +, buy-ins −); items
 * netting to zero get no row. Like the currency ledger, item ledger rows
 * only exist for completed sessions — callers must use
 * `deleteSessionItemData` on the not-completed path.
 */
export async function syncSessionItemData(
	db: DbInstance,
	sessionId: string,
	usages: SessionItemUsageInput[],
	sessionDate: Date
): Promise<void> {
	const statements: BatchStatement[] = [
		db.delete(sessionItemUsage).where(eq(sessionItemUsage.sessionId, sessionId)),
		db.delete(itemTransaction).where(eq(itemTransaction.sessionId, sessionId)),
	];

	// 8 columns per usage row → 12 rows stay under D1's 100-bind-param limit.
	const usageRows = usages.map((usage) => ({
		id: crypto.randomUUID(),
		sessionId,
		itemId: usage.itemId,
		direction: usage.direction,
		count: usage.count,
		itemName: usage.itemName,
		unitValue: usage.unitValue,
		currencyId: usage.currencyId,
	}));
	for (let i = 0; i < usageRows.length; i += 12) {
		statements.push(
			db.insert(sessionItemUsage).values(usageRows.slice(i, i + 12))
		);
	}

	const ledgerRows = [...computeNetItemCounts(usages)].map(
		([itemId, count]) => ({
			id: crypto.randomUUID(),
			itemId,
			sessionId,
			count,
			transactedAt: sessionDate,
		})
	);
	// 5 columns per ledger row → 20 rows per statement.
	for (let i = 0; i < ledgerRows.length; i += 20) {
		statements.push(
			db.insert(itemTransaction).values(ledgerRows.slice(i, i + 20))
		);
	}

	await runBatch(db, statements);
}

/** Remove all session-generated item data (usage rows + ledger rows) for a
 * not-completed session — the item-ledger mirror of
 * `deleteCurrencyTransaction`, covering discard and reopen. */
export async function deleteSessionItemData(
	db: DbInstance,
	sessionId: string
): Promise<void> {
	await runBatch(db, [
		db.delete(sessionItemUsage).where(eq(sessionItemUsage.sessionId, sessionId)),
		db.delete(itemTransaction).where(eq(itemTransaction.sessionId, sessionId)),
	]);
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
		.orderBy(...sessionEventOrderBy());

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
		await deleteSessionItemData(db, sessionId);
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

	const cashDetailValues = {
		buyIn: pl.totalBuyIn,
		cashOut: pl.cashOut,
		evCashOut: pl.evCashOut,
		virtualBuyIn: pl.virtualBuyIn > 0 ? pl.virtualBuyIn : null,
		virtualCashOut: pl.virtualCashOut > 0 ? pl.virtualCashOut : null,
	};

	if (existingDetail) {
		await db
			.update(sessionCashDetail)
			.set(cashDetailValues)
			.where(eq(sessionCashDetail.sessionId, sessionId));
	} else {
		await db.insert(sessionCashDetail).values({
			sessionId,
			...cashDetailValues,
		});
	}

	await syncSessionItemData(db, sessionId, pl.itemUsages, effectiveSessionDate);

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

/**
 * Write the event-derived purchase counts onto session_chip_purchase_result.
 * Every session_chip_purchase gets a row (count 0 when never bought). Uses an
 * upsert so it is safe even if a result row was never seeded.
 */
export async function syncChipPurchaseResults(
	db: DbInstance,
	sessionId: string,
	chipPurchaseCounts: Map<string, number>
): Promise<void> {
	const purchases = await db
		.select({ id: sessionChipPurchase.id })
		.from(sessionChipPurchase)
		.where(eq(sessionChipPurchase.sessionId, sessionId));
	if (purchases.length === 0) {
		return;
	}

	// D1 allows at most 100 bound parameters per statement; each result row
	// binds two values. Keep all chunks in one batch so a failed upsert cannot
	// leave a partially refreshed result set.
	const statements: BatchStatement[] = [];
	for (let i = 0; i < purchases.length; i += 50) {
		const rows = purchases.slice(i, i + 50).map((purchase) => ({
			sessionChipPurchaseId: purchase.id,
			count: chipPurchaseCounts.get(purchase.id) ?? 0,
		}));
		statements.push(
			db
				.insert(sessionChipPurchaseResult)
				.values(rows)
				.onConflictDoUpdate({
					target: sessionChipPurchaseResult.sessionChipPurchaseId,
					set: { count: sql`excluded.count` },
				})
		);
	}
	await runBatch(db, statements);
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
		.orderBy(...sessionEventOrderBy());

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
		await deleteSessionItemData(db, sessionId);
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
		virtualBuyIn: pl.virtualBuyIn > 0 ? pl.virtualBuyIn : null,
		virtualCashOut: pl.virtualCashOut > 0 ? pl.virtualCashOut : null,
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

	// Sync chip purchase result counts from the purchase_chips events.
	await syncChipPurchaseResults(db, sessionId, pl.chipPurchaseCounts);

	await syncSessionItemData(db, sessionId, pl.itemUsages, effectiveSessionDate);

	await syncCurrencyTransaction(
		db,
		sessionId,
		session.currencyId,
		pl.profitLoss,
		effectiveSessionDate,
		userId
	);
}

/** One uninterrupted period a player sat at the table (join → leave). */
export interface SeatStint {
	joinedAt: Date;
	leftAt: Date | null;
	seatPosition: number | null;
}

export interface SeatedPlayerState {
	isActive: boolean;
	joinedAt: Date;
	leftAt: Date | null;
	playerId: string;
	seatPosition: number | null;
	/** Every join → leave cycle for this player, oldest first. */
	stints: SeatStint[];
}

/**
 * Close the most recent still-open stint for a player.
 * A `player_leave` with no open stint (no join, or already left) is a no-op.
 */
function closeLatestOpenStint(stints: SeatStint[], leftAt: Date): void {
	for (let i = stints.length - 1; i >= 0; i--) {
		const stint = stints[i];
		if (stint && stint.leftAt === null) {
			stints[i] = { ...stint, leftAt };
			return;
		}
	}
}

/** Apply one player_join / player_leave event to the per-player stint map. */
function applySeatEvent(
	event: { eventType: string; payload: string; occurredAt: Date },
	stintsByPlayerId: Map<string, SeatStint[]>
): void {
	if (event.eventType === "player_join") {
		const parsed = playerJoinPayload.safeParse(JSON.parse(event.payload));
		if (!(parsed.success && parsed.data.playerId)) {
			return;
		}
		const stints = stintsByPlayerId.get(parsed.data.playerId) ?? [];
		stints.push({
			joinedAt: event.occurredAt,
			leftAt: null,
			seatPosition: parsed.data.seatPosition ?? null,
		});
		stintsByPlayerId.set(parsed.data.playerId, stints);
		return;
	}

	if (event.eventType === "player_leave") {
		const parsed = playerLeavePayload.safeParse(JSON.parse(event.payload));
		if (!(parsed.success && parsed.data.playerId)) {
			return;
		}
		const stints = stintsByPlayerId.get(parsed.data.playerId);
		if (stints) {
			closeLatestOpenStint(stints, event.occurredAt);
		}
	}
}

/**
 * Fold player_join / player_leave events into the seating roster.
 *
 * Seated players are no longer stored in a table — they are reconstructed
 * here from the event log. Only events that carry a `playerId` are folded
 * (the hero's own seat has no `playerId` and is derived separately by
 * `computeHeroSeatPositionFromEvents`).
 *
 * The same player may join and leave repeatedly within one session. Each
 * `player_join` opens a new stint; each `player_leave` closes the latest
 * open one. Every player appears exactly once in the result, but the full
 * in/out history is preserved on `stints` (oldest first). The top-level
 * `isActive` / `seatPosition` / `joinedAt` / `leftAt` reflect the most
 * recent (last) stint — i.e. the player's current state.
 *
 * `events` must already be ordered by (occurredAt, sortOrder, id).
 */
export function computeSeatedPlayersFromEvents(
	events: { eventType: string; payload: string; occurredAt: Date }[]
): SeatedPlayerState[] {
	const stintsByPlayerId = new Map<string, SeatStint[]>();

	for (const event of events) {
		applySeatEvent(event, stintsByPlayerId);
	}

	const result: SeatedPlayerState[] = [];
	for (const [playerId, stints] of stintsByPlayerId) {
		const current = stints.at(-1);
		if (!current) {
			continue;
		}
		result.push({
			playerId,
			seatPosition: current.seatPosition,
			isActive: current.leftAt === null,
			joinedAt: current.joinedAt,
			leftAt: current.leftAt,
			stints,
		});
	}
	return result;
}

export function computeHeroSeatPositionFromEvents(
	events: { eventType: string; payload: string }[]
): number | null {
	let heroSeat: number | null = null;
	for (const event of events) {
		if (
			event.eventType !== "player_join" &&
			event.eventType !== "player_leave"
		) {
			continue;
		}
		const parsed = playerJoinPayload.safeParse(JSON.parse(event.payload));
		if (!(parsed.success && parsed.data.isHero)) {
			continue;
		}
		if (event.eventType === "player_join") {
			heroSeat = parsed.data.seatPosition ?? heroSeat;
		} else {
			heroSeat = null;
		}
	}
	return heroSeat;
}
