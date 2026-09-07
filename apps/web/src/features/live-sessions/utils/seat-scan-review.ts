export type ScanRowKind =
	| "conflict"
	| "hero"
	| "known"
	| "new"
	| "none"
	| "occupied";

export interface ScannedSeat {
	isHero: boolean | null;
	name: string;
	seatNumber: number;
}

export interface ScanSeatState {
	occupancy: "empty" | "hero" | "player";
	playerId: string | null;
	playerName: string | null;
	seatPosition: number;
}

export interface ScanKnownPlayer {
	id: string;
	name: string;
}

export interface ScanRow {
	currentName: string | null;
	currentPlayerId: string | null;
	isPickable: boolean;
	isSelectedByDefault: boolean;
	kind: ScanRowKind;
	matchedPlayerId: string | null;
	name: string;
	seatPosition: number;
}

interface BuildScanRowsInput {
	knownPlayers: readonly ScanKnownPlayer[];
	scanned: readonly ScannedSeat[];
	seats: readonly ScanSeatState[];
}

function normalize(name: string): string {
	return name.trim().toLowerCase();
}

function buildKnownIndex(
	knownPlayers: readonly ScanKnownPlayer[]
): Map<string, string[]> {
	const index = new Map<string, string[]>();
	for (const candidate of knownPlayers) {
		const key = normalize(candidate.name);
		if (key === "") {
			continue;
		}
		index.set(key, [...(index.get(key) ?? []), candidate.id]);
	}
	return index;
}

function matchKnownPlayer(index: Map<string, string[]>, name: string) {
	const ids = index.get(normalize(name)) ?? [];
	return {
		isAmbiguous: ids.length > 1,
		matchedPlayerId: ids.length === 1 ? (ids[0] ?? null) : null,
	};
}

function pickScannedSeat(
	scanned: readonly ScannedSeat[],
	seatPosition: number
): ScannedSeat | null {
	return (
		scanned.find(
			(seat) => seat.seatNumber - 1 === seatPosition && seat.name.trim() !== ""
		) ?? null
	);
}

function emptyRow(seat: ScanSeatState): ScanRow {
	return {
		currentName: seat.playerName,
		currentPlayerId: seat.playerId,
		isPickable: false,
		isSelectedByDefault: false,
		kind: "none",
		matchedPlayerId: null,
		name: "",
		seatPosition: seat.seatPosition,
	};
}

function heroRow(seat: ScanSeatState, name: string): ScanRow {
	const isAlreadyHero = seat.occupancy === "hero";
	return {
		currentName: seat.playerName,
		currentPlayerId: seat.playerId,
		isPickable: !isAlreadyHero,
		isSelectedByDefault: !isAlreadyHero,
		kind: "hero",
		matchedPlayerId: null,
		name,
		seatPosition: seat.seatPosition,
	};
}

function seatedRow(
	seat: ScanSeatState,
	name: string,
	matchedPlayerId: string | null
): ScanRow {
	const isSamePlayer =
		seat.playerName !== null && normalize(seat.playerName) === normalize(name);
	if (isSamePlayer) {
		return {
			currentName: seat.playerName,
			currentPlayerId: seat.playerId,
			isPickable: false,
			isSelectedByDefault: false,
			kind: "occupied",
			matchedPlayerId,
			name,
			seatPosition: seat.seatPosition,
		};
	}
	return {
		currentName: seat.playerName,
		currentPlayerId: seat.playerId,
		isPickable: true,
		isSelectedByDefault: false,
		kind: "conflict",
		matchedPlayerId,
		name,
		seatPosition: seat.seatPosition,
	};
}

export function buildScanRows({
	knownPlayers,
	scanned,
	seats,
}: BuildScanRowsInput): ScanRow[] {
	const knownIndex = buildKnownIndex(knownPlayers);
	return seats.map((seat) => {
		const hit = pickScannedSeat(scanned, seat.seatPosition);
		if (hit === null) {
			return seat.occupancy === "hero" ? heroRow(seat, "") : emptyRow(seat);
		}
		const name = hit.name.trim();
		if (hit.isHero === true || seat.occupancy === "hero") {
			return heroRow(seat, name);
		}
		const { isAmbiguous, matchedPlayerId } = matchKnownPlayer(knownIndex, name);
		if (seat.occupancy === "player") {
			return seatedRow(seat, name, matchedPlayerId);
		}
		return {
			currentName: null,
			currentPlayerId: null,
			isPickable: true,
			isSelectedByDefault: !isAmbiguous,
			kind: matchedPlayerId === null ? "new" : "known",
			matchedPlayerId,
			name,
			seatPosition: seat.seatPosition,
		};
	});
}

export function countDetectedSeats(rows: readonly ScanRow[]): number {
	return rows.filter((row) => row.kind !== "none").length;
}
