import z from "zod";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
	if (!DATE_ONLY_PATTERN.test(value)) {
		return false;
	}
	const parsed = new Date(`${value}T00:00:00.000Z`);
	return (
		!Number.isNaN(parsed.getTime()) &&
		parsed.toISOString().slice(0, 10) === value
	);
}

export const dateOnlySchema = z.string().refine(isCalendarDate, {
	message: "Expected a calendar date as YYYY-MM-DD",
});
