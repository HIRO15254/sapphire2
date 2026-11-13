const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

const SHORT_MONTHS = MONTHS.map((month) => month.slice(0, 3));

function pad(value: number) {
	return String(value).padStart(2, "0");
}

export function localDateValue(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function localDateTimeValue(date: Date): string {
	return `${localDateValue(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function dateTimeValueToInstant(value: string): number | null {
	const time = new Date(value).getTime();
	return Number.isNaN(time) ? null : Math.floor(time / 1000);
}

export function dateValueToInstant(value: string): number | null {
	return dateTimeValueToInstant(`${value}T00:00`);
}

export function monthKey(date: Date): string {
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function monthLabel(date: Date): string {
	return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function dayLabel(date: Date, now: Date): string {
	const day = localDateValue(date);
	if (day === localDateValue(now)) {
		return "Today";
	}
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	if (day === localDateValue(yesterday)) {
		return "Yesterday";
	}
	return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function longDateLabel(date: Date): string {
	return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
