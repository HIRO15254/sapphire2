import z from "zod";
import {
	optionalNumericString,
	requiredNumericString,
} from "@/shared/lib/form-fields";

export const createTournamentSessionFormSchema = z.object({
	buyIn: requiredNumericString({ integer: true, min: 0 }),
	entryFee: optionalNumericString({ integer: true, min: 0 }),
	startingStack: requiredNumericString({ integer: true, min: 0 }),
	memo: z.string(),
	timerStartedAt: z.string(),
});

export function parseTimerStartedAt(value: string): number | undefined {
	const trimmed = value.trim();
	if (!trimmed) {
		return;
	}
	const parsed = new Date(trimmed);
	const ms = parsed.getTime();
	if (Number.isNaN(ms)) {
		return;
	}
	return Math.floor(ms / 1000);
}
