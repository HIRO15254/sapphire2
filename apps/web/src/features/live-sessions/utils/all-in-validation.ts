import type { RefinementCtx } from "zod";

/**
 * Shared `superRefine` for the all-in forms: `wins` must not exceed `trials`.
 * Both the create sheet (`use-all-in-form`) and the timeline editor
 * (`use-all-in-editor`) attach this so the invariant cannot drift between them —
 * it mirrors the server-side `allInPayload` refine (SA2-156). `wins` may be
 * fractional (a chopped pot counts as a partial win), so only the upper bound is
 * enforced; empty / non-numeric input is left to the field-level rule to avoid
 * stacking a confusing second error on the same field.
 */
export function refineWinsNotExceedingTrials(
	value: { trials: string; wins: string },
	ctx: RefinementCtx
): void {
	const wins = Number(value.wins.trim());
	if (value.wins.trim() === "" || !Number.isFinite(wins)) {
		return;
	}
	const trials = Number.parseInt(value.trials.trim(), 10);
	if (Number.isFinite(trials) && wins > trials) {
		ctx.addIssue({
			code: "custom",
			message: "Wins must not exceed trials",
			path: ["wins"],
		});
	}
}
