import { z } from "zod";

interface NumericRules {
	integer?: boolean;
	max?: number;
	min?: number;
}

function parseNumeric(value: string, integer: boolean) {
	const trimmed = value.trim();
	if (trimmed === "") {
		return Number.NaN;
	}
	return integer ? Number.parseInt(trimmed, 10) : Number(trimmed);
}

function numericStringSchema({
	required,
	integer = false,
	min,
	max,
}: NumericRules & { required: boolean }) {
	return z.string().superRefine((rawValue, ctx) => {
		const trimmed = rawValue.trim();
		if (trimmed === "") {
			if (required) {
				ctx.addIssue({ code: "custom", message: "Required" });
			}
			return;
		}
		const parsed = parseNumeric(trimmed, integer);
		if (!Number.isFinite(parsed)) {
			ctx.addIssue({ code: "custom", message: "Must be a number" });
			return;
		}
		if (min !== undefined && parsed < min) {
			ctx.addIssue({ code: "custom", message: `Must be at least ${min}` });
		}
		if (max !== undefined && parsed > max) {
			ctx.addIssue({ code: "custom", message: `Must be at most ${max}` });
		}
	});
}

/**
 * Zod schema for a required numeric string field. Keeps the raw string in form
 * state; callers convert to `Number(value)` on submit.
 */
export function requiredNumericString(rules: NumericRules = {}) {
	return numericStringSchema({ required: true, ...rules });
}

/** Zod schema for an optional numeric string field ("" is allowed). */
export function optionalNumericString(rules: NumericRules = {}) {
	return numericStringSchema({ required: false, ...rules });
}

/** Parse a numeric string; returns `undefined` for empty input. */
export function parseOptionalInt(value: string): number | undefined {
	const trimmed = value.trim();
	if (trimmed === "") {
		return undefined;
	}
	const parsed = Number.parseInt(trimmed, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseOptionalNumber(value: string): number | undefined {
	const trimmed = value.trim();
	if (trimmed === "") {
		return undefined;
	}
	const parsed = Number(trimmed);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseRequiredInt(value: string): number {
	return parseOptionalInt(value) ?? 0;
}

export function parseRequiredNumber(value: string): number {
	return parseOptionalNumber(value) ?? 0;
}
