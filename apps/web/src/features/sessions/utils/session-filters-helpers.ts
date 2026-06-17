export interface SessionFilterValues {
	currencyId?: string;
	dateFrom?: string;
	dateTo?: string;
	roomId?: string;
	type?: "cash_game" | "tournament";
}

export const SESSION_TYPE_VALUES = ["all", "cash_game", "tournament"] as const;
export type SessionTypeValue = (typeof SESSION_TYPE_VALUES)[number];

export const SESSION_TYPE_LABEL: Record<SessionTypeValue, string> = {
	all: "All",
	cash_game: "Cash",
	tournament: "Tournament",
};

/**
 * The chip value for the date-range filter: a compact `from ~ to` summary,
 * `from ~` / `~ to` for a one-sided bound, or `All dates` when unset.
 */
export function formatDateRangeLabel(
	dateFrom?: string,
	dateTo?: string
): string {
	if (dateFrom && dateTo) {
		return `${dateFrom} ~ ${dateTo}`;
	}
	if (dateFrom) {
		return `${dateFrom} ~`;
	}
	if (dateTo) {
		return `~ ${dateTo}`;
	}
	return "All dates";
}
