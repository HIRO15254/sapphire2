import { TRPCError } from "@trpc/server";

export function safeInteger(value: bigint | number | string): number {
	const number = Number(value);
	if (
		!Number.isSafeInteger(number) ||
		(typeof value !== "number" && BigInt(number) !== BigInt(value))
	) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Integer total exceeds the safe integer range",
		});
	}
	return number;
}

export function addSafeIntegers(a: number, b: number): number {
	safeInteger(a);
	safeInteger(b);
	return safeInteger(BigInt(a) + BigInt(b));
}
