import {
	allInPayload,
	cashSessionEndPayload,
	cashSessionStartPayload,
	chipsAddRemovePayload,
	purchaseChipsPayload,
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
	const anchor = toMs(events[startIndex].occurredAt);
	const acc: CashAcc = {
		stack: 0,
		totalBuyIn: 0,
		chipRemoveTotal: 0,
		evDiff: 0,
	};
	const points: CashTimelinePoint[] = [];

	for (let i = startIndex; i < events.length; i++) {
		const e = events[i];
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
			points.push(cashPoint(t, acc));
			continue;
		}
		if (e.eventType === "all_in") {
			const data = allInPayload.parse(e.payload);
			acc.evDiff +=
				data.potSize * (data.equity / 100) -
				(data.potSize / data.trials) * data.wins;
			points.push(cashPoint(t, acc));
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

interface TournamentAcc {
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

export function deriveTournamentTimeline(
	events: TimelineEvent[]
): TournamentTimelinePoint[] {
	const startIndex = events.findIndex((e) => e.eventType === "session_start");
	if (startIndex === -1) {
		return [];
	}
	const anchor = toMs(events[startIndex].occurredAt);
	const acc: TournamentAcc = {
		stack: 0,
		startingStack: null,
		totalEntries: null,
		remainingPlayers: null,
	};
	const points: TournamentTimelinePoint[] = [];

	for (let i = startIndex; i < events.length; i++) {
		const e = events[i];
		const t = toMs(e.occurredAt) - anchor;

		if (e.eventType === "session_start") {
			points.push(tournamentPoint(t, acc));
			continue;
		}
		if (e.eventType === "update_stack") {
			const data = updateStackPayload.parse(e.payload);
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
			points.push(tournamentPoint(t, acc));
			continue;
		}
		if (e.eventType === "purchase_chips") {
			const data = purchaseChipsPayload.parse(e.payload);
			acc.stack += data.chips;
			points.push(tournamentPoint(t, acc));
		}
	}

	return points;
}
