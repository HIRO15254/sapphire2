import { trpcErrorCode } from "@/shared/lib/query-failure";

export function isNameConflict(error: unknown): boolean {
	return (
		trpcErrorCode(error) === "CONFLICT" &&
		error instanceof Error &&
		error.message.includes("name")
	);
}

export function isConflict(error: unknown): boolean {
	return trpcErrorCode(error) === "CONFLICT";
}

export function toInstant(value: Date | string): number {
	return Math.floor(new Date(value).getTime() / 1000);
}
