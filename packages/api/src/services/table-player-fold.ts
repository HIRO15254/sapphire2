import {
	playerJoinPayload,
	playerLeavePayload,
} from "@sapphire2/db/constants/play-event-payloads";

export interface SeatEvent {
	payload: string;
	type: string;
}

export interface TimedSeatEvent extends SeatEvent {
	occurredAt: Date;
}

export interface SeatStint {
	joinedAt: Date;
	leftAt: Date | null;
	seatPosition: number | null;
}

export interface FoldedTablePlayer {
	isActive: boolean;
	joinedAt: Date;
	leftAt: Date | null;
	playerId: string;
	seatPosition: number | null;
	stints: SeatStint[];
}

type SeatChange =
	| { kind: "join"; playerId: string; seatPosition: number | null | undefined }
	| { kind: "leave"; playerId: string };

function readSeatChange(event: SeatEvent): SeatChange | null {
	if (event.type === "player_join") {
		const parsed = playerJoinPayload.safeParse(JSON.parse(event.payload));
		return parsed.success
			? {
					kind: "join",
					playerId: parsed.data.playerId,
					seatPosition: parsed.data.seatPosition,
				}
			: null;
	}
	if (event.type === "player_leave") {
		const parsed = playerLeavePayload.safeParse(JSON.parse(event.payload));
		return parsed.success
			? { kind: "leave", playerId: parsed.data.playerId }
			: null;
	}
	return null;
}

function applySeatChange(
	current: FoldedTablePlayer,
	change: SeatChange,
	at: Date
): void {
	const open = current.isActive ? current.stints.at(-1) : undefined;
	if (change.kind === "leave") {
		if (open) {
			open.leftAt = at;
			current.isActive = false;
			current.leftAt = at;
			current.seatPosition = null;
		}
		return;
	}
	if (open && change.seatPosition === undefined) {
		return;
	}
	if (open) {
		open.leftAt = at;
	} else {
		current.joinedAt = at;
	}
	const seatPosition = change.seatPosition ?? null;
	current.stints.push({ joinedAt: at, leftAt: null, seatPosition });
	current.isActive = true;
	current.leftAt = null;
	current.seatPosition = seatPosition;
}

export function foldTablePlayers(
	orderedEvents: readonly TimedSeatEvent[]
): FoldedTablePlayer[] {
	const players = new Map<string, FoldedTablePlayer>();
	for (const event of orderedEvents) {
		const change = readSeatChange(event);
		if (!change) {
			continue;
		}
		let current = players.get(change.playerId);
		if (!current) {
			if (change.kind === "leave") {
				continue;
			}
			current = {
				isActive: false,
				joinedAt: event.occurredAt,
				leftAt: null,
				playerId: change.playerId,
				seatPosition: null,
				stints: [],
			};
			players.set(change.playerId, current);
		}
		applySeatChange(current, change, event.occurredAt);
	}
	return [...players.values()];
}
