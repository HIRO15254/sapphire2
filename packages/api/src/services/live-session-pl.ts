import {
	allInPayload,
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipsAddRemovePayload,
	playerJoinPayload,
	playerLeavePayload,
	purchaseChipsPayload,
	tournamentSessionEndPayload,
	updateStackPayload,
} from "@sapphire2/db/constants/session-event-types";

interface CashGamePLResult {
	addonTotal: number;
	cashOut: number | null;
	chipRemoveTotal: number;
	evCashOut: number | null;
	evDiff: number;
	profitLoss: number | null;
	totalBuyIn: number;
}

interface TournamentPLResult {
	beforeDeadline: boolean;
	bountyPrizes: number | null;
	chipPurchaseCost: number;
	chipPurchaseCounts: Map<string, number>;
	placement: number | null;
	prizeMoney: number | null;
	profitLoss: number | null;
	totalEntries: number | null;
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
	};
}

export interface CashGameEventSummary {
	addonCount: number;
	cashOut: number | null;
	currentStack: number | null;
	maxStack: number | null;
	minStack: number | null;
	totalBuyIn: number;
}

function applyStartToSummary(
	summary: CashGameEventSummary,
	parsed: unknown
): void {
	const data = cashSessionStartPayload.parse(parsed);
	summary.totalBuyIn += data.buyInAmount;
	summary.currentStack = (summary.currentStack ?? 0) + data.buyInAmount;
}

function applyChipsToSummary(
	summary: CashGameEventSummary,
	parsed: unknown
): void {
	const data = chipsAddRemovePayload.parse(parsed);
	if (data.amount > 0) {
		summary.totalBuyIn += data.amount;
		summary.addonCount++;
	}
	if (summary.currentStack !== null) {
		summary.currentStack += data.amount;
	}
}

function applyStackToSummary(
	summary: CashGameEventSummary,
	parsed: unknown
): void {
	const { stackAmount } = updateStackPayload.parse(parsed);
	summary.maxStack =
		summary.maxStack === null
			? stackAmount
			: Math.max(summary.maxStack, stackAmount);
	summary.minStack =
		summary.minStack === null
			? stackAmount
			: Math.min(summary.minStack, stackAmount);
	summary.currentStack = stackAmount;
}

export function computeCashGameSummaryFromEvents(
	events: { eventType: string; payload: string }[]
): CashGameEventSummary {
	const summary: CashGameEventSummary = {
		addonCount: 0,
		cashOut: null,
		currentStack: null,
		maxStack: null,
		minStack: null,
		totalBuyIn: 0,
	};

	for (const event of events) {
		const parsed = JSON.parse(event.payload);
		if (event.eventType === "session_start") {
			applyStartToSummary(summary, parsed);
		} else if (event.eventType === "chips_add_remove") {
			applyChipsToSummary(summary, parsed);
		} else if (event.eventType === "update_stack") {
			applyStackToSummary(summary, parsed);
		} else if (event.eventType === "session_end") {
			summary.cashOut = cashSessionEndPayload.parse(parsed).cashOutAmount;
		}
	}

	return summary;
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
	};
}

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
	stints: SeatStint[];
}

function closeLatestOpenStint(stints: SeatStint[], leftAt: Date): void {
	for (let i = stints.length - 1; i >= 0; i--) {
		const stint = stints[i];
		if (stint && stint.leftAt === null) {
			stints[i] = { ...stint, leftAt };
			return;
		}
	}
}

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
