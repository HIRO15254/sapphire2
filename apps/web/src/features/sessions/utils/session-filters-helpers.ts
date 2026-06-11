import type { SessionFilterValues } from "@/features/sessions/components/session-filters";

export function countActiveFilters(filters: SessionFilterValues): number {
	let count = 0;
	if (filters.type) {
		count++;
	}
	if (filters.roomId) {
		count++;
	}
	if (filters.currencyId) {
		count++;
	}
	if (filters.dateFrom) {
		count++;
	}
	if (filters.dateTo) {
		count++;
	}
	return count;
}
