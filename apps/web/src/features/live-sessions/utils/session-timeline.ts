import {
	allInPayload,
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipsAddRemovePayload,
	purchaseChipsPayload,
	tournamentSessionEndPayload,
	updateStackPayload,
} from "@sapphire2/db/constants/session-event-types";

export interface TimelineEvent {
	eventType: string;
	occurredAt: string | Date | number;
	payload: unknown;
}

export interface CashTimelinePoint {
	evPl: number;
	pl: number;
	t: number;
}

export interface TournamentTimelinePoint {
	averageStack: number | null;
	stack: number;
	t: number;
}

function toMs(value: string | Date | number): number {
	if (typeof value === "number") {
		return value;
	}
	if (value instanceof Date) {
		return value.getTime();
	}
	return new Date(value).getTime();
}

interface CashAcc {
	chipRemoveTotal: number;
	evDiff: number;
	stack: number;
	totalBuyIn: number;
}

function cashPoint(t: number, acc: CashAcc): CashTimelinePoint {
	const pl = acc.stack + acc.chipRemoveTotal - acc.totalBuyIn;
	return { t, pl, evPl: pl + acc.evDiff };
}

export function deriveCashGameTimeline(
	events: TimelineEvent[]
): CashTimelinePoint[] {
	const startIndex = events.findIndex((e) => e.eventType === "session_start");
	if (startIndex === -1) {
		return [];
	}
	const startEvent = events[startIndex];
	if (!startEvent) {
		return [];
	}
	const anchor = toMs(startEvent.occurredAt);
	const acc: CashAcc = {
		stack: 0,
		totalBuyIn: 0,
		chipRemoveTotal: 0,
		evDiff: 0,
	};
	const points: CashTimelinePoint[] = [];

	for (let i = startIndex; i < events.length; i++) {
		const e = events[i];
		if (!e) {
			continue;
		}
		const t = toMs(e.occurredAt) - anchor;

		if (e.eventType === "session_start") {
			const data = cashSessionStartPayload.parse(e.payload);
			acc.stack += data.buyInAmount;
			acc.totalBuyIn += data.buyInAmount;
			points.push(cashPoint(t, acc));
			continue;
		}
		if (e.eventType === "update_stack") {
			const data = updateStackPayload.parse(e.payload);
			acc.stack = data.stackAmount;
			points.push(cashPoint(t, acc));
			continue;
		}
		if (e.eventType === "chips_add_remove") {
			const data = chipsAddRemovePayload.parse(e.payload);
			if (data.amount > 0) {
				acc.totalBuyIn += data.amount;
				acc.stack += data.amount;
			} else {
				acc.chipRemoveTotal += -data.amount;
				acc.stack -= -data.amount;
			}
			// Not a stack record: only update the running basis. The change is
			// reflected at the next update_stack / session_end point.
			continue;
		}
		if (e.eventType === "all_in") {
			const data = allInPayload.parse(e.payload);
			acc.evDiff +=
				data.potSize * (data.equity / 100) -
				(data.potSize / data.trials) * data.wins;
			// Not a stack record: only accumulate evDiff. Reflected at the next
			// update_stack / session_end point.
			continue;
		}
		if (e.eventType === "session_end") {
			const data = cashSessionEndPayload.parse(e.payload);
			acc.stack = data.cashOutAmount;
			points.push(cashPoint(t, acc));
		}
	}

	return points;
}

interface ChipPurchaseCount {
	chipsPerUnit: number;
	count: number;
	name: string;
}

interface TournamentAcc {
	chipPurchaseCounts: ChipPurchaseCount[];
	remainingPlayers: number | null;
	stack: number;
	startingStack: number | null;
	totalEntries: number | null;
}

function tournamentAverageStack(acc: TournamentAcc): number | null {
	if (
		acc.startingStack === null ||
		acc.totalEntries === null ||
		acc.remainingPlayers === null ||
		acc.remainingPlayers <= 0
	) {
		return null;
	}
	return (acc.startingStack * acc.totalEntries) / acc.remainingPlayers;
}

function totalChipsInPlay(acc: TournamentAcc, totalEntries: number): number {
	const baseChips = (acc.startingStack ?? 0) * totalEntries;
	const purchaseChips = acc.chipPurchaseCounts.reduce(
		(sum, c) => sum + c.count * c.chipsPerUnit,
		0
	);
	return baseChips + purchaseChips;
}

function tournamentPoint(
	t: number,
	acc: TournamentAcc
): TournamentTimelinePoint {
	return {
		t,
		stack: acc.stack,
		averageStack: tournamentAverageStack(acc),
	};
}

function applyTournamentUpdateStack(
	acc: TournamentAcc,
	payload: unknown
): void {
	const data = updateStackPayload.parse(payload);
	acc.stack = data.stackAmount;
	if (acc.startingStack === null) {
		acc.startingStack = data.stackAmount;
	}
	if (data.totalEntries != null) {
		acc.totalEntries = data.totalEntries;
	}
	if (data.remainingPlayers != null) {
		acc.remainingPlayers = data.remainingPlayers;
	}
	if (data.chipPurchaseCounts) {
		acc.chipPurchaseCounts = data.chipPurchaseCounts;
	}
}

function applyTournamentSessionEnd(acc: TournamentAcc, payload: unknown): void {
	const data = tournamentSessionEndPayload.parse(payload);
	if (data.beforeDeadline === false) {
		acc.totalEntries = data.totalEntries;
		acc.stack =
			data.placement === 1 ? totalChipsInPlay(acc, data.totalEntries) : 0;
	}
}

/**
 * The tournament's starting stack, taken from the first recorded stack. The
 * create flow logs the starting stack as the first `update_stack`, so the start
 * point can plot at the starting stack rather than at zero. `null` when no stack
 * was ever recorded.
 */
function findTournamentStartingStack(
	events: TimelineEvent[],
	startIndex: number
): number | null {
	for (let i = startIndex; i < events.length; i++) {
		const event = events[i];
		if (event?.eventType === "update_stack") {
			return updateStackPayload.parse(event.payload).stackAmount;
		}
	}
	return null;
}

function applyTournamentEvent(
	acc: TournamentAcc,
	eventType: string,
	payload: unknown,
	startingStack: number | null
): boolean {
	if (eventType === "session_start") {
		// Tournament start counts as recording a stack equal to the starting
		// stack, so the curve begins at the starting stack rather than zero.
		acc.startingStack = startingStack;
		acc.stack = startingStack ?? 0;
		return true;
	}
	if (eventType === "update_stack") {
		applyTournamentUpdateStack(acc, payload);
		return true;
	}
	if (eventType === "purchase_chips") {
		// Not a stack record: fold the chips into the running stack so they are
		// reflected at the next update_stack point, but don't plot the purchase.
		acc.stack += purchaseChipsPayload.parse(payload).chips;
		return false;
	}
	if (eventType === "session_end") {
		applyTournamentSessionEnd(acc, payload);
		return true;
	}
	return false;
}

export function deriveTournamentTimeline(
	events: TimelineEvent[]
): TournamentTimelinePoint[] {
	const startIndex = events.findIndex((e) => e.eventType === "session_start");
	if (startIndex === -1) {
		return [];
	}
	const startEvent = events[startIndex];
	if (!startEvent) {
		return [];
	}
	const anchor = toMs(startEvent.occurredAt);
	const startingStack = findTournamentStartingStack(events, startIndex);
	const acc: TournamentAcc = {
		stack: 0,
		startingStack: null,
		totalEntries: null,
		remainingPlayers: null,
		chipPurchaseCounts: [],
	};
	const points: TournamentTimelinePoint[] = [];

	for (let i = startIndex; i < events.length; i++) {
		const e = events[i];
		if (!e) {
			continue;
		}
		const handled = applyTournamentEvent(
			acc,
			e.eventType,
			e.payload,
			startingStack
		);
		if (handled) {
			points.push(tournamentPoint(toMs(e.occurredAt) - anchor, acc));
		}
	}

	return points;
}
