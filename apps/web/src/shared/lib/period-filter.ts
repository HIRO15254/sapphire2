export const PERIODS = ["7d", "30d", "90d", "ytd", "all", "custom"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABEL: Record<Period, string> = {
	"7d": "7 days",
	"30d": "30 days",
	"90d": "90 days",
	ytd: "YTD",
	all: "All time",
	custom: "Custom",
};

const DAY_SECONDS = 86_400;

export interface DateRangeFilters {
	from?: number;
	period: Period;
	to?: number;
}

function startOfUtcDaySec(nowSec: number): number {
	const d = new Date(nowSec * 1000);
	return Math.floor(
		Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000
	);
}

function startOfUtcYearSec(nowSec: number): number {
	const d = new Date(nowSec * 1000);
	return Math.floor(Date.UTC(d.getUTCFullYear(), 0, 1) / 1000);
}

export function resolveDateRange(
	filters: DateRangeFilters,
	nowSec: number = Math.floor(Date.now() / 1000)
): { dateFrom?: number; dateTo?: number } {
	const dayStart = startOfUtcDaySec(nowSec);
	const dayEnd = dayStart + DAY_SECONDS - 1;
	switch (filters.period) {
		case "7d":
			return { dateFrom: dayStart - 6 * DAY_SECONDS, dateTo: dayEnd };
		case "30d":
			return { dateFrom: dayStart - 29 * DAY_SECONDS, dateTo: dayEnd };
		case "90d":
			return { dateFrom: dayStart - 89 * DAY_SECONDS, dateTo: dayEnd };
		case "ytd":
			return { dateFrom: startOfUtcYearSec(nowSec), dateTo: dayEnd };
		case "custom": {
			const range: { dateFrom?: number; dateTo?: number } = {};
			if (filters.from !== undefined) {
				range.dateFrom = filters.from;
			}
			if (filters.to !== undefined) {
				range.dateTo = filters.to;
			}
			return range;
		}
		default:
			return {};
	}
}

const DATE_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

export function dateInputToEpochSec(
	value: string,
	endOfDay = false
): number | undefined {
	if (!DATE_INPUT_RE.test(value)) {
		return undefined;
	}
	const [y = 0, m = 1, d = 1] = value.split("-").map(Number);
	const ms = endOfDay
		? Date.UTC(y, m - 1, d, 23, 59, 59)
		: Date.UTC(y, m - 1, d, 0, 0, 0);
	return Math.floor(ms / 1000);
}

export function epochSecToDateInput(sec: number | undefined): string {
	if (sec === undefined) {
		return "";
	}
	return new Date(sec * 1000).toISOString().slice(0, 10);
}
