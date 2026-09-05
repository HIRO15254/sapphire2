import type { RefinementCtx } from "zod";

export function refineWinsNotExceedingTrials(
	value: { trials: string; wins: string },
	ctx: RefinementCtx
): void {
	const wins = Number(value.wins.trim());
	if (value.wins.trim() === "" || !Number.isFinite(wins)) {
		return;
	}
	const trimmedTrials = value.trials.trim();
	const trials = Number(trimmedTrials);
	if (
		trimmedTrials !== "" &&
		Number.isSafeInteger(trials) &&
		trials >= 1 &&
		wins > trials
	) {
		ctx.addIssue({
			code: "custom",
			message: "Wins must not exceed trials",
			path: ["wins"],
		});
	}
}
