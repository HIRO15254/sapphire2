import { TRPCError } from "@trpc/server";

export function assertSeatPositionFitsTableSize(
	seatPosition: number | null | undefined,
	tableSize: number | null
): void {
	if (
		seatPosition === null ||
		seatPosition === undefined ||
		tableSize === null
	) {
		return;
	}
	if (tableSize < 1 || seatPosition >= tableSize) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Seat position is outside this table's size",
		});
	}
}
