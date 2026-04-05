export function toTimeInputValue(value: string | Date): string {
	const date = typeof value === "string" ? new Date(value) : value;
	return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function applyTimeToDate(
	original: string | Date,
	timeStr: string
): Date {
	const date = new Date(typeof original === "string" ? original : original);
	const [hours, minutes] = timeStr.split(":").map(Number);
	date.setHours(hours ?? 0, minutes ?? 0);
	return date;
}

export function validateOccurredAtTime(
	timeStr: string,
	original: string | Date,
	minTime: Date | null | undefined,
	maxTime: Date | null | undefined
): string | null {
	const nextDate = applyTimeToDate(original, timeStr);
	if (minTime && nextDate.getTime() < minTime.getTime()) {
		return `Must be after ${toTimeInputValue(minTime)}`;
	}
	if (maxTime && nextDate.getTime() > maxTime.getTime()) {
		return `Must be before ${toTimeInputValue(maxTime)}`;
	}
	return null;
}

export function toOccurredAtTimestamp(
	original: string | Date | undefined,
	timeStr: string
): number | undefined {
	if (!(original && timeStr)) {
		return undefined;
	}
	return Math.floor(applyTimeToDate(original, timeStr).getTime() / 1000);
}
