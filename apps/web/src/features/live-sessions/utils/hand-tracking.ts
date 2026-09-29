import type { SeatOccupancy } from "@/features/live-sessions/hooks/use-session-seats";

const SECONDS_PER_HOUR = 3600;
const MIN_RATE_SECONDS = 60;

function wrap(value: number, size: number): number {
	return ((value % size) + size) % size;
}

function toRing(seated: readonly number[]): number[] {
	return [...new Set(seated)].sort((a, b) => a - b);
}

export function seatedPositions(
	seats: readonly { occupancy: SeatOccupancy; seatPosition: number }[]
): number[] {
	return seats
		.filter((seat) => seat.occupancy !== "empty")
		.map((seat) => seat.seatPosition);
}

export function resolveDealerSeat(
	storedSeat: number | null,
	seated: readonly number[]
): number | null {
	const ring = toRing(seated);
	const first = ring[0];
	if (first === undefined) {
		return null;
	}
	if (storedSeat === null) {
		return first;
	}
	return ring.find((seat) => seat >= storedSeat) ?? first;
}

export function stepDealerSeat(
	storedSeat: number | null,
	step: number,
	seated: readonly number[]
): number | null {
	const ring = toRing(seated);
	const current = resolveDealerSeat(storedSeat, ring);
	if (current === null) {
		return null;
	}
	return ring[wrap(ring.indexOf(current) + step, ring.length)] ?? null;
}

export function computeHandsPerHour(
	handCount: number | null,
	activeSeconds: number
): number | null {
	if (activeSeconds < MIN_RATE_SECONDS) {
		return null;
	}
	return Math.round((handCount ?? 0) / (activeSeconds / SECONDS_PER_HOUR));
}
