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
} from "@sapphire2/db/constants/session-event-types";
import {
	currencyTransaction,
	transactionType,
} from "@sapphire2/db/schema/currency";
import { gameSession } from "@sapphire2/db/schema/session";
import { sessionCashDetail } from "@sapphire2/db/schema/session-cash-detail";
import { sessionChipPurchase } from "@sapphire2/db/schema/session-chip-purchase";
import { sessionChipPurchaseResult } from "@sapphire2/db/schema/session-chip-purchase-result";
import { sessionEvent } from "@sapphire2/db/schema/session-event";
import { sessionTournamentDetail } from "@sapphire2/db/schema/session-tournament-detail";
import { tournament } from "@sapphire2/db/schema/tournament";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import type { protectedProcedure } from "../index";

type DbInstance = Parameters<
	Parameters<typeof protectedProcedure.query>[0]
>[0]["ctx"]["db"];

/**
 * Assert the session exists, is a tournament, and is owned by the user. Source
 * (live / manual) does not matter — multi-day chains can mix live and manually
 * recorded days.
 */
export async function assertOwnedTournamentSession(
	db: DbInstance,
	sessionId: string,
	userId: string
): Promise<void> {
	const [found] = await db
		.select({ userId: gameSession.userId, kind: gameSession.kind })
		.from(gameSession)
		.where(eq(gameSession.id, sessionId));
	if (!found || found.kind !== "tournament" || found.userId !== userId) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "Tournament session not found",
		});
	}
}

/**
 * Validate that `previousSessionId` is a promoted, unconsumed tournament session
 * owned by the user (any source), and return its bagged stack to carry forward.
 * Shared by the live `create` link and the manual `session.create` link.
 */
export async function resolvePromotedLinkTarget(
	db: DbInstance,
	previousSessionId: string,
	userId: string
): Promise<number | null> {
	await assertOwnedTournamentSession(db, previousSessionId, userId);

	const [detail] = await db
		.select({
			result: sessionTournamentDetail.result,
			bagStack: sessionTournamentDetail.bagStack,
		})
		.from(sessionTournamentDetail)
		.where(eq(sessionTournamentDetail.sessionId, previousSessionId));
	if (detail?.result !== "promoted") {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "The linked session has not been promoted",
		});
	}

	const [consumer] = await db
		.select({ sessionId: sessionTournamentDetail.sessionId })
		.from(sessionTournamentDetail)
		.where(eq(sessionTournamentDetail.previousSessionId, previousSessionId))
		.limit(1);
	if (consumer) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "This promoted session is already linked to another day",
		});
	}

	return detail.bagStack ?? null;
}

interface CashGamePLResult {
	addonTotal: number;
	cashOut: number | null;
	evCashOut: number | null;
	evDiff: number;
	profitLoss: number | null;
	totalBuyIn: number;
}

interface TournamentPLResult {
	/** Chip count bagged when promoted to the next day; null otherwise. */
	bagStack: number | null;
	beforeDeadline: boolean;
	bountyPrizes: number | null;
	/** Σ cost across all purchase_chips events. */
	chipPurchaseCost: number;
	/** Purchase count keyed by sessionChipPurchaseId. */
	chipPurchaseCounts: Map<string, number>;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number | null;
	/** How the session_end concluded: promoted to next day, finished, or none. */
	result: "promoted" | "finished" | null;
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
		profitLoss,
		evCashOut,
		evDiff: totalEvDiff,
		addonTotal,
	};
}

interface TournamentEndInfo {
	bagStack: number | null;
	beforeDeadline: boolean;
	bountyPrizes: number | null;
	placement: number | null;
	prizeMoney: number | null;
	result: "promoted" | "finished" | null;
	totalEntries: number | null;
}

const EMPTY_TOURNAMENT_END: TournamentEndInfo = {
	bagStack: null,
	beforeDeadline: false,
	bountyPrizes: null,
	placement: null,
	prizeMoney: null,
	result: null,
	totalEntries: null,
};

/**
 * Interpret a tournament session_end payload as either a promote (advance to
 * the next day, carrying a bagged stack) or a finish (placement / prize).
 * Returns the neutral EMPTY_TOURNAMENT_END when the payload does not parse.
 */
function parseTournamentSessionEnd(payload: unknown): TournamentEndInfo {
	const parsed = tournamentSessionEndPayload.safeParse(payload);
	if (!parsed.success) {
		return EMPTY_TOURNAMENT_END;
	}
	if ("result" in parsed.data) {
		return {
			...EMPTY_TOURNAMENT_END,
			result: "promoted",
			bagStack: parsed.data.bagStack,
		};
	}
	if (parsed.data.beforeDeadline === false) {
		return {
			bagStack: null,
			beforeDeadline: false,
			bountyPrizes: parsed.data.bountyPrizes,
			placement: parsed.data.placement,
			prizeMoney: parsed.data.prizeMoney,
			result: "finished",
			totalEntries: parsed.data.totalEntries,
		};
	}
	return {
		bagStack: null,
		beforeDeadline: true,
		bountyPrizes: parsed.data.bountyPrizes,
		placement: null,
		prizeMoney: parsed.data.prizeMoney,
		result: "finished",
		totalEntries: null,
	};
}

/**
 * One tournament session reduced to the fields needed to aggregate a multi-day
 * chain into a single "flight". `chipPurchaseCost` is the Σ from this session's
 * purchase_chips events.
 */
export interface FlightSessionInput {
	bountyPrizes: number | null;
	buyIn: number | null;
	chipPurchaseCost: number;
	entryFee: number | null;
	placement: number | null;
	previousSessionId: string | null;
	prizeMoney: number | null;
	result: "promoted" | "finished" | null;
	sessionId: string;
	totalEntries: number | null;
}

/** A multi-day chain collapsed to a single result row. */
export interface AggregatedFlight {
	bountyPrizes: number | null;
	headSessionId: string;
	/** True once the tail session finished (placement / prize known). */
	isComplete: boolean;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number | null;
	/** Chain order, head → tail. */
	sessionIds: string[];
	totalCost: number;
	totalEntries: number | null;
}

function walkFlightChain(
	head: FlightSessionInput,
	successorByPrev: Map<string, FlightSessionInput>
): FlightSessionInput[] {
	const chain: FlightSessionInput[] = [];
	const visited = new Set<string>();
	let current: FlightSessionInput | undefined = head;
	while (current && !visited.has(current.sessionId)) {
		visited.add(current.sessionId);
		chain.push(current);
		current = successorByPrev.get(current.sessionId);
	}
	return chain;
}

function buildAggregatedFlight(chain: FlightSessionInput[]): AggregatedFlight {
	// chain is always non-empty: walkFlightChain pushes the head first.
	const head = chain[0] as FlightSessionInput;
	const tail = chain.at(-1) as FlightSessionInput;
	const totalCost = chain.reduce(
		(acc, s) => acc + (s.buyIn ?? 0) + (s.entryFee ?? 0) + s.chipPurchaseCost,
		0
	);
	const sessionIds = chain.map((s) => s.sessionId);

	if (tail.result === "finished") {
		const income = (tail.prizeMoney ?? 0) + (tail.bountyPrizes ?? 0);
		return {
			headSessionId: head.sessionId,
			sessionIds,
			totalCost,
			prizeMoney: tail.prizeMoney,
			bountyPrizes: tail.bountyPrizes,
			placement: tail.placement,
			totalEntries: tail.totalEntries,
			profitLoss: income - totalCost,
			isComplete: true,
		};
	}

	return {
		headSessionId: head.sessionId,
		sessionIds,
		totalCost,
		prizeMoney: null,
		bountyPrizes: null,
		placement: null,
		totalEntries: null,
		profitLoss: null,
		isComplete: false,
	};
}

/**
 * Collapse multi-day tournament chains into "flights". Sessions are linked by
 * `previousSessionId`; each chain (head → tail) becomes one AggregatedFlight
 * whose cost is the sum across the chain and whose result is taken from the
 * tail (the last day). A session whose `previousSessionId` is null or points
 * outside the input set starts a chain; busted re-entries that were never
 * promoted simply form their own single-session flights. A pure cycle (no
 * head) is dropped rather than looped over.
 */
export function aggregateTournamentFlights(
	sessions: FlightSessionInput[]
): AggregatedFlight[] {
	const byId = new Map<string, FlightSessionInput>();
	for (const s of sessions) {
		byId.set(s.sessionId, s);
	}

	const successorByPrev = new Map<string, FlightSessionInput>();
	for (const s of sessions) {
		if (s.previousSessionId !== null && byId.has(s.previousSessionId)) {
			successorByPrev.set(s.previousSessionId, s);
		}
	}

	const flights: AggregatedFlight[] = [];
	for (const s of sessions) {
		const isHead =
			s.previousSessionId === null || !byId.has(s.previousSessionId);
		if (isHead) {
			flights.push(buildAggregatedFlight(walkFlightChain(s, successorByPrev)));
		}
	}
	return flights;
}

export function computeTournamentPLFromEvents(
	events: { eventType: string; payload: string }[],
	tournamentBuyIn?: number,
	tournamentEntryFee?: number
): TournamentPLResult {
	const chipPurchaseCounts = new Map<string, number>();
	let totalChipPurchaseCost = 0;
	let end: TournamentEndInfo = EMPTY_TOURNAMENT_END;

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
			end = parseTournamentSessionEnd(parsed);
		}
	}

	const {
		result,
		bagStack,
		placement,
		totalEntries,
		prizeMoney,
		bountyPrizes,
	} = end;
	const beforeDeadline = end.beforeDeadline;
	const income = (prizeMoney ?? 0) + (bountyPrizes ?? 0);
	const cost =
		(tournamentBuyIn ?? 0) + (tournamentEntryFee ?? 0) + totalChipPurchaseCost;
	// A promote realizes its cost (buy-in / fees / chip purchases) as a loss now;
	// the chain's prize is booked on the tail finished session. A finished
	// session books income − cost. No session_end ⇒ still in progress ⇒ null.
	let profitLoss: number | null;
	if (result === "promoted") {
		profitLoss = cost === 0 ? 0 : -cost;
	} else if (result === "finished") {
		profitLoss = income - cost;
	} else {
		profitLoss = null;
	}

	return {
		chipPurchaseCost: totalChipPurchaseCost,
		chipPurchaseCounts,
		beforeDeadline,
		placement,
		totalEntries,
		prizeMoney,
		bountyPrizes,
		profitLoss,
		result,
		bagStack,
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
		.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

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

/**
 * Write the event-derived purchase counts onto session_chip_purchase_result.
 * Every session_chip_purchase gets a row (count 0 when never bought). Uses an
 * upsert so it is safe even if a result row was never seeded.
 */
async function syncChipPurchaseResults(
	db: DbInstance,
	sessionId: string,
	chipPurchaseCounts: Map<string, number>
): Promise<void> {
	const purchases = await db
		.select({ id: sessionChipPurchase.id })
		.from(sessionChipPurchase)
		.where(eq(sessionChipPurchase.sessionId, sessionId));
	for (const p of purchases) {
		const count = chipPurchaseCounts.get(p.id) ?? 0;
		await db
			.insert(sessionChipPurchaseResult)
			.values({ sessionChipPurchaseId: p.id, count })
			.onConflictDoUpdate({
				target: sessionChipPurchaseResult.sessionChipPurchaseId,
				set: { count },
			});
	}
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
		.orderBy(asc(sessionEvent.occurredAt), asc(sessionEvent.sortOrder));

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
		result: pl.result,
		bagStack: pl.bagStack,
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
 * `events` must already be ordered by (occurredAt, sortOrder).
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
